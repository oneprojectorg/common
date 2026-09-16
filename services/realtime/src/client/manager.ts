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

    this.registerSocketListeners(this.supabase);
  }

  /**
   * realtime-js fans a single websocket drop out to every joined channel as
   * `CHANNEL_ERROR` and then rejoins each one on its own backoff, so a page
   * holding fifteen channels reports fifteen failures for one event. The drop is
   * recorded once here, at the socket, instead of once per channel.
   */
  private registerSocketListeners(client: SupabaseClient): void {
    const { stateChangeCallbacks } = client.realtime;

    stateChangeCallbacks.error.push((error: unknown) => {
      logger.warn('[Realtime] Socket error', {
        error,
        openChannels: this.channels.size,
      });
    });

    stateChangeCallbacks.close.push((event: unknown) => {
      logger.warn('[Realtime] Socket closed', {
        ...closeDetails(event),
        openChannels: this.channels.size,
      });
    });
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
        } else if (status === 'CHANNEL_ERROR') {
          this.subscribedChannels.delete(channel);
          this.connectionListeners.forEach((listener) => listener(false));

          // `err` is set only when the join itself was rejected — a server-side
          // failure specific to this channel. Without it the status is the
          // socket-drop fan-out, already logged once by the socket listeners.
          if (err) {
            logger.warn('[Realtime] Channel join rejected', {
              error: err,
              channel,
            });
          }
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

/** The socket close callback is handed a `CloseEvent` the types do not describe. */
function closeDetails(event: unknown): { code?: number; reason?: string } {
  if (typeof event !== 'object' || event === null) {
    return {};
  }

  return {
    code:
      'code' in event && typeof event.code === 'number'
        ? event.code
        : undefined,
    reason:
      'reason' in event && typeof event.reason === 'string'
        ? event.reason
        : undefined,
  };
}
