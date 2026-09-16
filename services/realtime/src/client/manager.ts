import { type ChannelName } from '@op/common/realtime';
import { logger } from '@op/logging/client';
import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { type RealtimeMessage, realtimeMessageSchema } from '../schemas';

export type RealtimeHandler = (event: {
  channel: ChannelName;
  data: RealtimeMessage;
}) => void;

export interface RealtimeConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

/**
 * Singleton realtime manager for Supabase Realtime channel subscriptions
 */
export class RealtimeManager {
  private static instance: RealtimeManager | null = null;
  private supabase: SupabaseClient | null = null;
  private channels = new Map<ChannelName, RealtimeChannel>();
  private channelListeners = new Map<ChannelName, Set<RealtimeHandler>>();
  /** Channels whose socket join has been confirmed — see `onSubscribed`. */
  private subscribedChannels = new Set<ChannelName>();
  private connectionListeners = new Set<(isConnected: boolean) => void>();
  private config: RealtimeConfig | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): RealtimeManager {
    if (!RealtimeManager.instance) {
      RealtimeManager.instance = new RealtimeManager();
    }
    return RealtimeManager.instance;
  }

  /**
   * Initialize the RealtimeManager with configuration
   * Must be called before using subscribe()
   */
  static initialize(config: RealtimeConfig): void {
    const instance = RealtimeManager.getInstance();
    instance.config = config;
  }

  private ensureClient() {
    if (this.supabase) {
      return;
    }

    if (!this.config) {
      throw new Error(
        'RealtimeManager not initialized. Call RealtimeManager.initialize() first.',
      );
    }

    this.supabase = createClient(
      this.config.supabaseUrl,
      this.config.supabaseAnonKey,
    );

    // realtime-js reports one socket drop as CHANNEL_ERROR on every joined
    // channel and rejoins them itself, so the drop is logged once here. Info, not
    // warn: the client logger reports warn and error to PostHog error tracking.
    this.supabase.realtime.stateChangeCallbacks.close.push(
      (event: CloseEvent) => {
        logger.info('[Realtime] Socket closed', {
          code: event.code,
          reason: event.reason,
          openChannels: this.channels.size,
        });
      },
    );
  }

  /**
   * Subscribe to a channel with a message handler
   * Returns an unsubscribe function to clean up the subscription
   */
  subscribe(
    channel: ChannelName,
    handler: RealtimeHandler,
    /**
     * Called once the channel's socket join is confirmed, and immediately if it
     * already was.
     *
     * Broadcasts are not replayed, so anything published before the join lands
     * is lost. A caller that cannot tolerate that — one waiting on a background
     * job that may finish first — uses this to re-read once the channel is
     * actually live, which is the only point after which the broadcast is
     * guaranteed to arrive.
     */
    onSubscribed?: () => void,
  ): () => void {
    this.ensureClient();

    if (!this.supabase) {
      throw new Error('Supabase client not initialized');
    }

    // Add handler to channel listeners
    if (!this.channelListeners.has(channel)) {
      this.channelListeners.set(channel, new Set());
    }
    const listeners = this.channelListeners.get(channel)!;

    // Prevent duplicate handlers
    if (listeners.has(handler)) {
      logger.warn('[Realtime] Handler already subscribed to channel', {
        channel,
      });
      return () => {};
    }

    listeners.add(handler);

    // A later subscriber joins a channel whose socket is already open, so the
    // status callback below has already fired and will not fire again.
    if (onSubscribed && this.subscribedChannels.has(channel)) {
      onSubscribed();
    }

    // Create channel subscription if it doesn't exist
    if (!this.channels.has(channel)) {
      const realtimeChannel = this.supabase.channel(channel);

      realtimeChannel.on(
        'broadcast',
        { event: 'invalidation' },
        ({ payload }) => {
          // Validate the message with Zod schema
          const parseResult = realtimeMessageSchema.safeParse(payload);

          if (!parseResult.success) {
            logger.error('[Realtime] Invalid message format', {
              error: parseResult.error,
              channel,
            });
            return;
          }

          const data = parseResult.data;

          // Notify all listeners for this channel
          const channelListeners = this.channelListeners.get(channel);
          if (channelListeners) {
            channelListeners.forEach((listener) => listener({ channel, data }));
          }
        },
      );

      realtimeChannel.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          this.subscribedChannels.add(channel);
          onSubscribed?.();
          this.connectionListeners.forEach((listener) => listener(true));
        } else if (status === 'CLOSED') {
          this.subscribedChannels.delete(channel);
          this.connectionListeners.forEach((listener) => listener(false));
        } else if (status === 'CHANNEL_ERROR' && err) {
          // Set only when the server rejected this channel's join; a plain socket
          // drop arrives without it and is logged once at the socket.
          logger.warn('[Realtime] Channel join rejected', {
            error: err,
            channel,
          });
        }
      });

      this.channels.set(channel, realtimeChannel);
    }

    // Return unsubscribe function
    return () => {
      this.unsubscribe(channel, handler);
    };
  }

  /**
   * Unsubscribe a specific handler from a channel
   */
  private unsubscribe(channel: ChannelName, handler: RealtimeHandler): void {
    const listeners = this.channelListeners.get(channel);
    if (!listeners) {
      return;
    }

    // Remove the handler
    listeners.delete(handler);

    // If no more handlers for this channel, remove the Supabase channel
    if (listeners.size === 0) {
      this.channelListeners.delete(channel);

      this.subscribedChannels.delete(channel);

      const realtimeChannel = this.channels.get(channel);
      if (realtimeChannel && this.supabase) {
        this.supabase.removeChannel(realtimeChannel);
        this.channels.delete(channel);
      }
    }

    // If no more active channels, disconnect
    if (this.channels.size === 0) {
      this.disconnect();
    }
  }

  /**
   * Tear down all channel subscriptions when the last one goes away. The client
   * is retained (not nulled) so the next subscribe() reuses it and reconnects on
   * the same connection instead of opening a fresh socket.
   */
  private disconnect(): void {
    if (!this.supabase) {
      return;
    }

    this.channels.forEach((realtimeChannel) => {
      this.supabase?.removeChannel(realtimeChannel);
    });
    this.channels.clear();
    this.channelListeners.clear();
    this.subscribedChannels.clear();
  }

  /**
   * Add a connection state listener
   */
  addConnectionListener(listener: (isConnected: boolean) => void) {
    this.connectionListeners.add(listener);
  }

  removeConnectionListener(listener: (isConnected: boolean) => void) {
    this.connectionListeners.delete(listener);
  }
}
