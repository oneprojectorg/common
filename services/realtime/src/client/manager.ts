import {
  Centrifuge,
  type ErrorContext,
  type PublicationContext,
  type Subscription,
} from 'centrifuge';

import { type ChannelName } from '../channels';
import { type RealtimeMessage, realtimeMessageSchema } from '../schemas';

export interface RealtimeConfig {
  wsUrl: string;
  getToken: () => Promise<string>;
}

/**
 * Handler for query invalidation messages received from mutation channels.
 * Called when a mutation triggers a cache invalidation.
 */
export type MutationHandler = (queryKey: readonly string[]) => void;

/**
 * Singleton realtime manager for WebSocket connections and channel subscriptions.
 * Handles both general pub/sub and tRPC mutation channel subscriptions.
 */
export class RealtimeManager {
  private static instance: RealtimeManager | null = null;
  private centrifuge: Centrifuge | null = null;
  private subscriptions = new Map<ChannelName, Subscription>();
  private channelListeners = new Map<
    ChannelName,
    Set<(data: RealtimeMessage) => void>
  >();
  private connectionListeners = new Set<(isConnected: boolean) => void>();
  private config: RealtimeConfig | null = null;

  // Mutation channel state (subscribe-later pattern)
  private pendingMutationChannels = new Set<ChannelName>();
  private activeMutationChannels = new Set<ChannelName>();
  private mutationHandler: MutationHandler | null = null;

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
  static initialize(config: RealtimeConfig): RealtimeManager {
    const instance = RealtimeManager.getInstance();
    instance.config = config;

    return instance;
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
    channel: ChannelName,
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

    listeners.add(handler);

    // Create subscription if it doesn't exist
    if (!this.subscriptions.has(channel)) {
      const sub = this.centrifuge.newSubscription(channel);

      sub.on('publication', (ctx: PublicationContext) => {
        // Validate the message with Zod schema
        const parseResult = realtimeMessageSchema.safeParse(ctx.data);

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
    channel: ChannelName,
    handler: (data: RealtimeMessage) => void,
  ): void {
    const listeners = this.channelListeners.get(channel);
    if (!listeners) {
      return;
    }

    // Remove the handler
    listeners.delete(handler);

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
    if (this.subscriptions.size === 0) {
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

  // ─────────────────────────────────────────────────────────────────────────────
  // Mutation Channels (Subscribe-Later Pattern)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Add mutation channels from tRPC response headers.
   * Called from non-React code (tRPC fetch callback).
   *
   * If a mutation handler is registered, subscribes immediately.
   * Otherwise, queues the channels until a handler is registered.
   */
  addMutationChannels(channels: ChannelName[]): void {
    for (const channel of channels) {
      // Skip if already active
      if (this.activeMutationChannels.has(channel)) {
        continue;
      }

      if (this.mutationHandler) {
        this.subscribeMutationChannel(channel);
      } else {
        this.pendingMutationChannels.add(channel);
      }
    }
  }

  /**
   * Register a handler for mutation channel invalidations.
   * Called from React hook (has access to queryClient).
   *
   * Flushes any pending channels that were queued before the handler was ready.
   * Returns an unsubscribe function to clean up.
   */
  registerMutationHandler(handler: MutationHandler): () => void {
    this.mutationHandler = handler;
    this.flushPendingMutationChannels();

    return () => {
      this.mutationHandler = null;
      // Unsubscribe from all mutation channels
      for (const channel of this.activeMutationChannels) {
        this.unsubscribeMutationChannel(channel);
      }
      this.activeMutationChannels.clear();
    };
  }

  /**
   * Subscribe to a mutation channel and handle query invalidation messages.
   */
  private subscribeMutationChannel(channel: ChannelName): void {
    if (this.activeMutationChannels.has(channel)) {
      return;
    }

    const messageHandler = (message: RealtimeMessage) => {
      if (message.type === 'query-invalidation' && this.mutationHandler) {
        this.mutationHandler(message.queryKey);
      }
    };

    try {
      this.subscribe(channel, messageHandler);
      // we should be managing this from Centrifuge state (perhaps not needed at all to be managed separately). Check Centrifuge sdk.
      this.activeMutationChannels.add(channel);
      this.pendingMutationChannels.delete(channel);
    } catch (error) {
      // RealtimeManager not initialized yet - keep in pending
      console.warn('[Realtime] Cannot subscribe to mutation channel:', error);
    }
  }

  /**
   * Unsubscribe from a mutation channel.
   */
  private unsubscribeMutationChannel(channel: ChannelName): void {
    // The subscribe() method returns an unsubscribe function, but for mutation channels
    // we track them differently. We need to remove listeners for this channel.
    const listeners = this.channelListeners.get(channel);
    if (listeners) {
      // Clear all listeners for this channel (mutation channels have one listener each)
      for (const listener of listeners) {
        this.unsubscribe(channel, listener);
      }
    }
  }

  /**
   * Flush pending mutation channels by subscribing to them.
   */
  private flushPendingMutationChannels(): void {
    for (const channel of this.pendingMutationChannels) {
      this.subscribeMutationChannel(channel);
    }
  }
}
