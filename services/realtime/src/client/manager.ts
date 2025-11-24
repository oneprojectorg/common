import { Centrifuge, type Subscription } from 'centrifuge';

import type { InvalidationMessage, RealtimeMessage } from '../types';

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
   */
  subscribe(channel: string, handler: (data: RealtimeMessage) => void) {
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
