import type { ChannelName } from './channels';

type InvalidationEvent = {
  channels: ChannelName[];
  queryKeys: unknown[][];
};

type Listener = (event: InvalidationEvent) => void;

/**
 * Registry + pub/sub for channel-based query invalidation.
 *
 * - Store: maps channels -> query keys
 * - Pub/Sub: emits invalidation events with resolved keys
 *
 * Subscribers receive fully resolved events - no store internals exposed.
 */
class QueryChannelRegistry {
  private channelMap = new Map<ChannelName, Set<string>>();
  private listeners = new Set<Listener>();

  /** Register query key for channels */
  register(queryKey: unknown[], channels: ChannelName[]): void {
    const key = JSON.stringify(queryKey);
    for (const channel of channels) {
      let keys = this.channelMap.get(channel);
      if (!keys) {
        keys = new Set();
        this.channelMap.set(channel, keys);
      }
      keys.add(key);
    }
  }

  /** Unregister query key from all channels */
  unregister(queryKey: unknown[]): void {
    const key = JSON.stringify(queryKey);
    for (const keys of this.channelMap.values()) {
      keys.delete(key);
    }
  }

  /** Emit mutation - resolves keys internally, subscribers get clean event */
  emit(channels: ChannelName[]): void {
    const queryKeys = this.resolveKeys(channels);
    if (queryKeys.length === 0) return;

    const event: InvalidationEvent = { channels, queryKeys };
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  /** Subscribe to invalidation events */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private resolveKeys(channels: ChannelName[]): unknown[][] {
    const seen = new Set<string>();
    const result: unknown[][] = [];

    for (const channel of channels) {
      const keys = this.channelMap.get(channel);
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
}

export const queryChannelRegistry = new QueryChannelRegistry();

export type { InvalidationEvent, Listener as InvalidationListener };
