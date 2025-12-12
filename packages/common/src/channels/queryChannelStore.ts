import type { ChannelName } from './channels';

/**
 * Maps channels to query keys for cache invalidation.
 *
 * - Query returns x-subscription-channels -> register(queryKey, channels)
 * - Mutation returns x-mutation-channels -> getQueryKeys(channels) -> invalidate
 */

/**
 * Store that maps channels to query keys for cache invalidation.
 */
export class QueryChannelStore {
  /** channel -> Set of JSON-serialized query keys */
  private store = new Map<ChannelName, Set<string>>();

  /** Register a query key to be invalidated when these channels are mutated */
  addQueryKeyForChannels(queryKey: unknown[], channels: ChannelName[]) {
    const key = JSON.stringify(queryKey);
    for (const channel of channels) {
      let channelKeys = this.store.get(channel);
      if (!channelKeys) {
        channelKeys = new Set();
        this.store.set(channel, channelKeys);
      }
      channelKeys.add(key);
    }
  }

  /** Get all query keys that should be invalidated for the given channels */
  getQueryKeysForChannels(channels: ChannelName[]): unknown[][] {
    const seen = new Set<string>();
    const result: unknown[][] = [];

    for (const channel of channels) {
      const keys = this.store.get(channel);
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
