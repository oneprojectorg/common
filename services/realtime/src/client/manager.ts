import { type ChannelName } from '@op/common/realtime';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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
  }

  /**
   * Subscribe to a channel with a message handler
   * Returns an unsubscribe function to clean up the subscription
   */
  subscribe(channel: ChannelName, handler: RealtimeHandler): () => void {
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
      console.warn(
        '[Realtime] Handler already subscribed to channel:',
        channel,
      );
      return () => {};
    }

    listeners.add(handler);

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
            console.error(
              '[Realtime] Invalid message format:',
              parseResult.error,
            );
            return;
          }

          const data = parseResult.data;

          // Notify all listeners for this channel
          const channelListeners = this.channelListeners.get(channel);
          if (channelListeners) {
            channelListeners.forEach((listener) =>
              listener({ channel, data }),
            );
          }
        },
      );

      realtimeChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Subscribed to channel:', channel);
          this.connectionListeners.forEach((listener) => listener(true));
        } else if (status === 'CLOSED') {
          console.log('[Realtime] Unsubscribed from channel:', channel);
          this.connectionListeners.forEach((listener) => listener(false));
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Channel error:', channel);
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
   * Disconnect from Supabase Realtime and clean up all channels
   */
  private disconnect(): void {
    if (!this.supabase) {
      return;
    }

    console.log('[Realtime] Disconnecting...');

    // Clean up all channels
    this.channels.forEach((realtimeChannel) => {
      this.supabase!.removeChannel(realtimeChannel);
    });
    this.channels.clear();
    this.channelListeners.clear();

    this.supabase = null;
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
