import { type ChannelName } from '@op/common/realtime';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

import { type RealtimeMessage, realtimeMessageSchema } from '../schemas';

export type RealtimeHandler = (event: {
  channel: ChannelName;
  data: RealtimeMessage;
}) => void;

export interface RealtimeConfig {
  supabase: SupabaseClient;
}

/**
 * Singleton realtime manager for Supabase broadcast subscriptions
 */
export class RealtimeManager {
  private static instance: RealtimeManager | null = null;
  private supabase: SupabaseClient | null = null;
  private subscriptions = new Map<ChannelName, RealtimeChannel>();
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
    instance.supabase = config.supabase;
  }

  /**
   * Subscribe to a channel with a message handler
   * Returns an unsubscribe function to clean up the subscription
   */
  subscribe(channel: ChannelName, handler: RealtimeHandler): () => void {
    if (!this.config || !this.supabase) {
      throw new Error(
        'RealtimeManager not initialized. Call RealtimeManager.initialize() first.',
      );
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
      return () => {}; // Return no-op function
    }

    listeners.add(handler);

    // Create subscription if it doesn't exist
    if (!this.subscriptions.has(channel)) {
      const realtimeChannel = this.supabase
        .channel(channel)
        .on('broadcast', { event: 'invalidation' }, (payload) => {
          // Validate the message with Zod schema
          const parseResult = realtimeMessageSchema.safeParse(payload.payload);

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
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[Realtime] Subscribed to channel:', channel);
            this.connectionListeners.forEach((listener) => listener(true));
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            console.log('[Realtime] Disconnected from channel:', channel);
            this.connectionListeners.forEach((listener) => listener(false));
          }
        });

      this.subscriptions.set(channel, realtimeChannel);
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

    // If no more handlers for this channel, unsubscribe from Supabase
    if (listeners.size === 0) {
      this.channelListeners.delete(channel);

      const sub = this.subscriptions.get(channel);
      if (sub) {
        sub.unsubscribe();
        this.subscriptions.delete(channel);
      }
    }

    // If no more active subscriptions, we can notify disconnection
    if (this.subscriptions.size === 0) {
      this.connectionListeners.forEach((listener) => listener(false));
    }
  }

  /**
   * Disconnect from all channels and clean up
   */
  disconnect(): void {
    console.log('[Realtime] Disconnecting...');

    // Clean up all subscriptions
    this.subscriptions.forEach((sub) => {
      sub.unsubscribe();
    });
    this.subscriptions.clear();
    this.channelListeners.clear();
    this.connectionListeners.forEach((listener) => listener(false));
  }

  /**
   * Add a connection state listener (called immediately with current state if connected)
   */
  addConnectionListener(listener: (isConnected: boolean) => void) {
    this.connectionListeners.add(listener);
    // Immediately notify with current state if we have active subscriptions
    if (this.subscriptions.size > 0) {
      listener(true);
    }
  }

  removeConnectionListener(listener: (isConnected: boolean) => void) {
    this.connectionListeners.delete(listener);
  }
}
