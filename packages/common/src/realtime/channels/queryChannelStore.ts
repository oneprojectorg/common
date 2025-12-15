import mitt from 'mitt';

import type { ChannelName } from './channels';

type SubscriptionAddedEvent = {
  queryKey: unknown[];
  channels: ChannelName[];
};

type MutationAddedEvent = {
  channels: ChannelName[];
};

type RegistryEvents = {
  'subscription:added': SubscriptionAddedEvent;
  'mutation:added': MutationAddedEvent;
};

/**
 * Registry for channel-based query tracking.
 *
 * - Tracks channel subscriptions (query → channels mapping)
 * - Tracks channel mutations
 * - Emits events via mitt when subscriptions/mutations are registered
 *
 * Invalidation is handled by consumers subscribing to events.
 */
class QueryChannelRegistry {
  private channelToQueryKeys = new Map<ChannelName, Set<string>>();
  private emitter = mitt<RegistryEvents>();

  /**
   * Get all query keys registered to a set of channels.
   */
  getQueryKeysForChannels(channels: ChannelName[]): unknown[][] {
    const seen = new Set<string>();
    const result: unknown[][] = [];

    for (const channel of channels) {
      const keys = this.channelToQueryKeys.get(channel);
      if (keys) {
        for (const key of keys) {
          if (!seen.has(key)) {
            seen.add(key);
            result.push(JSON.parse(key) as unknown[]);
          }
        }
      }
    }
    return result;
  }

  /**
   * Register a query's subscription to channels.
   * Emits 'subscription:added' event.
   */
  registerSubscription(queryKey: unknown[], channels: ChannelName[]): void {
    const key = JSON.stringify(queryKey);
    for (const channel of channels) {
      let keys = this.channelToQueryKeys.get(channel);
      if (!keys) {
        keys = new Set();
        this.channelToQueryKeys.set(channel, keys);
      }
      keys.add(key);
    }
    this.emitter.emit('subscription:added', { queryKey, channels });
  }

  /**
   * Register a mutation for channels.
   * Emits 'mutation:added' event.
   */
  registerMutation(channels: ChannelName[]): void {
    this.emitter.emit('mutation:added', { channels });
  }

  /**
   * Subscribe to registry events (subscription:added, mutation:added).
   */
  on<K extends keyof RegistryEvents>(
    event: K,
    handler: (payload: RegistryEvents[K]) => void,
  ): () => void {
    this.emitter.on(event, handler);
    return () => this.emitter.off(event, handler);
  }
}

export const queryChannelRegistry = new QueryChannelRegistry();

export type { MutationAddedEvent, RegistryEvents, SubscriptionAddedEvent };
