import { Centrifuge, type Subscription } from 'centrifuge';

import type { InvalidationMessage } from '../types';

function getCentrifugoConfig() {
  const wsUrl = process.env.NEXT_PUBLIC_CENTRIFUGO_WS_URL;
  const token = process.env.NEXT_PUBLIC_CENTRIFUGO_TOKEN;

  if (!wsUrl) {
    throw new Error(
      'Missing required environment variable: NEXT_PUBLIC_CENTRIFUGO_WS_URL',
    );
  }

  if (!token) {
    throw new Error(
      'Missing required environment variable: NEXT_PUBLIC_CENTRIFUGO_TOKEN',
    );
  }

  return { wsUrl, token };
}

/**
 * Singleton realtime manager to ensure only one WebSocket connection
 * across the entire application.
 *
 * This class manages:
 * - A single WebSocket connection
 * - Multiple channel subscriptions
 * - Multiple listeners per channel
 * - Automatic cleanup when no listeners remain
 */
export class RealtimeManager {
  private static instance: RealtimeManager | null = null;
  private centrifuge: Centrifuge | null = null;
  private subscriptions = new Map<string, Subscription>();
  private channelListeners = new Map<
    string,
    Set<(data: InvalidationMessage) => void>
  >();
  private connectionListeners = new Set<(isConnected: boolean) => void>();
  private refCount = 0;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance of RealtimeManager
   */
  static getInstance(): RealtimeManager {
    if (!RealtimeManager.instance) {
      RealtimeManager.instance = new RealtimeManager();
    }
    return RealtimeManager.instance;
  }

  /**
   * Initialize the connection if not already connected
   */
  private ensureConnected() {
    if (this.centrifuge) {
      return;
    }

    const { wsUrl, token } = getCentrifugoConfig();

    this.centrifuge = new Centrifuge(wsUrl, {
      // TODO: should use getToken function to generate token per user (on tRPC API)
      token,
    });

    this.centrifuge.on('connected', () => {
      console.log('[Realtime] Connected');
      this.connectionListeners.forEach((listener) => listener(true));
    });

    this.centrifuge.on('disconnected', () => {
      console.log('[Realtime] Disconnected');
      this.connectionListeners.forEach((listener) => listener(false));
    });

    this.centrifuge.on('error', (ctx: any) => {
      console.error('[Realtime] Error:', ctx);
    });

    this.centrifuge.connect();
  }

  /**
   * Subscribe to a channel with a message handler
   *
   * Multiple handlers can subscribe to the same channel. Each handler
   * will be called when a message is received on that channel.
   *
   * @param channel - Channel name to subscribe to
   * @param handler - Callback function to handle messages
   */
  subscribe(channel: string, handler: (data: InvalidationMessage) => void) {
    this.ensureConnected();
    this.refCount++;

    // Add handler to channel listeners
    if (!this.channelListeners.has(channel)) {
      this.channelListeners.set(channel, new Set());
    }
    this.channelListeners.get(channel)!.add(handler);

    // Create subscription if it doesn't exist
    if (!this.subscriptions.has(channel)) {
      const sub = this.centrifuge!.newSubscription(channel);

      sub.on('publication', (ctx: any) => {
        const data = ctx.data as InvalidationMessage;

        // Notify all listeners for this channel
        const listeners = this.channelListeners.get(channel);
        if (listeners) {
          listeners.forEach((listener) => listener(data));
        }
      });

      sub.on('subscribed', () => {
        console.log('[Realtime] Subscribed to channel:', channel);
      });

      sub.subscribe();
      this.subscriptions.set(channel, sub);
    }
  }

  /**
   * Unsubscribe a handler from a channel
   *
   * If no more handlers remain for the channel, the subscription is removed.
   * If no more subscriptions remain, the connection is closed.
   *
   * @param channel - Channel name to unsubscribe from
   * @param handler - Handler function to remove
   */
  unsubscribe(channel: string, handler: (data: InvalidationMessage) => void) {
    const listeners = this.channelListeners.get(channel);
    if (listeners) {
      listeners.delete(handler);

      // If no more listeners for this channel, unsubscribe
      if (listeners.size === 0) {
        this.channelListeners.delete(channel);
        const sub = this.subscriptions.get(channel);
        if (sub) {
          sub.unsubscribe();
          this.subscriptions.delete(channel);
          console.log('[Realtime] Unsubscribed from channel:', channel);
        }
      }
    }

    this.refCount--;

    // Disconnect if no more references
    if (this.refCount === 0 && this.centrifuge) {
      console.log('[Realtime] No more subscribers, disconnecting');
      this.centrifuge.disconnect();
      this.centrifuge = null;
    }
  }

  /**
   * Add a connection state listener
   *
   * The listener will be called immediately with the current state if connected.
   *
   * @param listener - Callback function to handle connection state changes
   */
  addConnectionListener(listener: (isConnected: boolean) => void) {
    this.connectionListeners.add(listener);
    // Immediately notify with current state if connected
    if (this.centrifuge?.state === 'connected') {
      listener(true);
    }
  }

  /**
   * Remove a connection state listener
   *
   * @param listener - Callback function to remove
   */
  removeConnectionListener(listener: (isConnected: boolean) => void) {
    this.connectionListeners.delete(listener);
  }
}
