import mitt from 'mitt';

import type { ChannelName } from './channels';

type QueryAddedEvent = {
  queryKey: unknown;
  channels: ChannelName[];
};

export type MutationAddedEvent = {
  channels: ChannelName[];
  mutationId: string;
};

export type QueryRemovedEvent = {
  queryKey: unknown;
};

export type ChannelRemovedEvent = {
  channel: ChannelName;
};

export type ChannelSubscribedEvent = {
  channel: ChannelName;
};

export type RegistryEvents = {
  'query:added': QueryAddedEvent;
  'mutation:added': MutationAddedEvent;
  'channel:removed': ChannelRemovedEvent;
  'channel:subscribed': ChannelSubscribedEvent;
};

/**
 * Registry for channel-based query tracking.
 *
 * - Tracks channel queries (channel → query-keys, query-key → channels)
 * - Emits events when queries register, mutations register, or a channel
 *   loses its last query (so the realtime subscriber can drop its WS sub)
 *
 * Invalidation is handled by consumers subscribing to events.
 */
class QueryChannelRegistry {
  private channelToQueryKeys = new Map<ChannelName, Set<string>>();
  private queryKeyToChannels = new Map<string, Set<ChannelName>>();
  private emitter = mitt<RegistryEvents>();

  /**
   * Get all query keys registered to a set of channels.
   */
  getQueryKeysForChannels(channels: ChannelName[]): unknown[] {
    const seen = new Set<string>();
    const result: unknown[] = [];

    for (const channel of channels) {
      const keys = this.channelToQueryKeys.get(channel);
      if (keys) {
        for (const key of keys) {
          if (!seen.has(key)) {
            seen.add(key);
            try {
              result.push(JSON.parse(key));
            } catch {
              // Skip malformed keys - shouldn't happen if stringify succeeded
            }
          }
        }
      }
    }
    return result;
  }

  /**
   * Register a query to channels. Idempotent: re-registering the same query
   * with a smaller channel set decrements the channels it no longer touches
   * (and emits 'channel:removed' for any that drain). Emits 'query:added'.
   */
  registerQuery({ queryKey, channels }: QueryAddedEvent): void {
    const key = JSON.stringify(queryKey);
    const nextChannels = new Set(channels);

    const prevChannels = this.queryKeyToChannels.get(key);
    if (prevChannels) {
      for (const channel of prevChannels) {
        if (!nextChannels.has(channel)) {
          this.removeKeyFromChannel(key, channel);
        }
      }
    }

    for (const channel of nextChannels) {
      let keys = this.channelToQueryKeys.get(channel);
      if (!keys) {
        keys = new Set();
        this.channelToQueryKeys.set(channel, keys);
      }
      keys.add(key);
    }
    this.queryKeyToChannels.set(key, nextChannels);

    this.emitter.emit('query:added', { queryKey, channels });
  }

  /**
   * Drop a query's references from every channel it touched. Emits
   * 'channel:removed' for any channel whose last query just left.
   * No-op for query keys that were never registered.
   */
  unregisterQuery({ queryKey }: QueryRemovedEvent): void {
    const key = JSON.stringify(queryKey);
    const channels = this.queryKeyToChannels.get(key);
    if (!channels) {
      return;
    }

    for (const channel of channels) {
      this.removeKeyFromChannel(key, channel);
    }
    this.queryKeyToChannels.delete(key);
  }

  /**
   * Register a mutation for channels.
   * Emits 'mutation:added' event.
   */
  registerMutation({ channels, mutationId }: MutationAddedEvent): void {
    this.emitter.emit('mutation:added', { channels, mutationId });
  }

  /**
   * Report that a channel's socket join is confirmed.
   *
   * Emits 'channel:subscribed', which the realtime subscriber treats as a cue
   * to re-read every query on that channel. Broadcasts are not replayed, so
   * whatever was published before the join is unrecoverable otherwise: on a
   * first subscribe that is the gap between a query answering and its channel
   * going live, and on a rejoin it is everything that happened while the
   * connection was down.
   *
   * Fires per join rather than per channel, so a reconnect re-reads rather
   * than leaving a tab showing what it held when the socket died.
   */
  notifyChannelSubscribed(channel: ChannelName): void {
    this.emitter.emit('channel:subscribed', { channel });
  }

  /**
   * Subscribe to registry events (query:added, mutation:added, channel:removed,
   * channel:subscribed).
   */
  on<K extends keyof RegistryEvents>(
    event: K,
    handler: (payload: RegistryEvents[K]) => void,
  ): () => void {
    this.emitter.on(event, handler);
    return () => this.emitter.off(event, handler);
  }

  private removeKeyFromChannel(key: string, channel: ChannelName): void {
    const keys = this.channelToQueryKeys.get(channel);
    if (!keys) {
      return;
    }
    keys.delete(key);
    if (keys.size === 0) {
      this.channelToQueryKeys.delete(channel);
      this.emitter.emit('channel:removed', { channel });
    }
  }
}

export const queryChannelRegistry = new QueryChannelRegistry();
