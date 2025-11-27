import {
  Centrifuge,
  type ErrorContext,
  type PublicationContext,
  type Subscription,
} from 'centrifuge';

import type { InvalidationMessage, RealtimeMessage } from '../types';

export interface RealtimeConfig {
  wsUrl: string;
  getToken: () => Promise<string>;
}

/**
 * Singleton realtime manager for WebSocket connections and channel subscriptions
 */
export class RealtimeManager {
  private static instance: RealtimeManager | null = null;
  private centrifuge: Centrifuge | null = null;
  private subscriptions = new Map<string, Subscription>();
  private channelListeners = new Map<
    string,
    Set<(data: RealtimeMessage) => void>
  >();
  private connectionListeners = new Set<(isConnected: boolean) => void>();
  private config: RealtimeConfig | null = null;
  private refCount = 0;

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

  private ensureConnected() {
    if (this.centrifuge) {
      return;
    }

    if (!this.config) {
      throw new Error(
        'RealtimeManager not initialized. Call RealtimeManager.initialize() first.',
      );
    }

    this.centrifuge = new Centrifuge(this.config.wsUrl, {
      // Centrifuge will automatically call getToken when connecting
      // and when the token is about to expire for automatic refresh
      getToken: async () => {
        const token = await this.config!.getToken();
        return token;
      },
    });

    this.centrifuge.on('connected', () => {
      console.log('[Realtime] Connected');
      this.connectionListeners.forEach((listener) => listener(true));
    });

    this.centrifuge.on('disconnected', () => {
      console.log('[Realtime] Disconnected');
      this.connectionListeners.forEach((listener) => listener(false));
    });

    this.centrifuge.on('error', (ctx: ErrorContext) => {
      console.error('[Realtime] Error:', ctx);
    });

    this.centrifuge.connect();
  }

  /**
   * Subscribe to a channel with a message handler
   * Returns an unsubscribe function to clean up the subscription
   */
  subscribe(
    channel: string,
    handler: (data: RealtimeMessage) => void,
  ): () => void {
    this.ensureConnected();

    if (!this.centrifuge) {
      throw new Error('Centrifuge instance not initialized');
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

    this.refCount++;
    listeners.add(handler);

    // Create subscription if it doesn't exist
    if (!this.subscriptions.has(channel)) {
      const sub = this.centrifuge.newSubscription(channel);

      sub.on('publication', (ctx: PublicationContext) => {
        const data = ctx.data as InvalidationMessage;

        // Notify all listeners for this channel
        const channelListeners = this.channelListeners.get(channel);
        if (channelListeners) {
          channelListeners.forEach((listener) => listener(data));
        }
      });

      sub.on('subscribed', () => {
        console.log('[Realtime] Subscribed to channel:', channel);
      });

      sub.on('unsubscribed', () => {
        console.log('[Realtime] Unsubscribed from channel:', channel);
      });

      sub.subscribe();
      this.subscriptions.set(channel, sub);
    }

    // Return unsubscribe function
    return () => {
      this.unsubscribe(channel, handler);
    };
  }

  /**
   * Unsubscribe a specific handler from a channel
   */
  private unsubscribe(
    channel: string,
    handler: (data: RealtimeMessage) => void,
  ): void {
    const listeners = this.channelListeners.get(channel);
    if (!listeners) {
      return;
    }

    // Remove the handler
    listeners.delete(handler);
    this.refCount--;

    // If no more handlers for this channel, unsubscribe from Centrifuge
    if (listeners.size === 0) {
      this.channelListeners.delete(channel);

      const sub = this.subscriptions.get(channel);
      if (sub) {
        sub.unsubscribe();
        sub.removeAllListeners();
        this.subscriptions.delete(channel);
      }
    }

    // If no more active subscriptions, disconnect
    if (this.refCount === 0) {
      this.disconnect();
    }
  }

  /**
   * Disconnect from the WebSocket server and clean up all subscriptions
   */
  private disconnect(): void {
    if (!this.centrifuge) {
      return;
    }

    console.log('[Realtime] Disconnecting...');

    // Clean up all subscriptions
    this.subscriptions.forEach((sub) => {
      sub.unsubscribe();
      sub.removeAllListeners();
    });
    this.subscriptions.clear();
    this.channelListeners.clear();

    // Disconnect and clean up centrifuge instance
    this.centrifuge.disconnect();
    this.centrifuge = null;
  }

  /**
   * Add a connection state listener (called immediately with current state if connected)
   */
  addConnectionListener(listener: (isConnected: boolean) => void) {
    this.connectionListeners.add(listener);
    // Immediately notify with current state if connected
    if (this.centrifuge?.state === 'connected') {
      listener(true);
    }
  }

  removeConnectionListener(listener: (isConnected: boolean) => void) {
    this.connectionListeners.delete(listener);
  }
}
