/**
 * QueryChannelStore - Maps channels to query keys for invalidation.
 *
 * When queries respond with x-subscription-channels, we register the mapping.
 * When mutations respond with x-mutation-channels, we look up and invalidate.
 *
 * The frontend owns this mapping - the API only speaks channels.
 */
class QueryChannelStore {
  /**
   * Map of channel -> Set of serialized query keys.
   * We serialize query keys to strings for proper Set comparison.
   */
  private queryKeyByChannel = new Map<string, Set<string>>();

  /**
   * Reverse map of serialized query key -> Set of channels.
   * Used for cleanup when a query is removed.
   */
  private channelsByQueryKey = new Map<string, Set<string>>();

  /**
   * Serialize a query key to a stable string for Map/Set operations.
   */
  private serializeQueryKey(queryKey: unknown[]): string {
    return JSON.stringify(queryKey);
  }

  /**
   * Deserialize a query key string back to array form.
   */
  private deserializeQueryKey(serialized: string): unknown[] {
    return JSON.parse(serialized) as unknown[];
  }

  /**
   * Register a query's subscription to channels.
   * Called when query response has x-subscription-channels header.
   */
  registerQueryChannels(queryKey: unknown[], channels: string[]): void {
    const serializedKey = this.serializeQueryKey(queryKey);

    // Track channels for this query (for cleanup)
    if (!this.channelsByQueryKey.has(serializedKey)) {
      this.channelsByQueryKey.set(serializedKey, new Set());
    }
    const queryChannels = this.channelsByQueryKey.get(serializedKey);
    if (!queryChannels) {
      return;
    }

    // Register query key in each channel
    for (const channel of channels) {
      // Add to channel -> queryKeys map
      let channelKeys = this.queryKeyByChannel.get(channel);
      if (!channelKeys) {
        channelKeys = new Set();
        this.queryKeyByChannel.set(channel, channelKeys);
      }
      channelKeys.add(serializedKey);

      // Track this channel for the query
      queryChannels.add(channel);
    }
  }

  /**
   * Get all query keys that should be invalidated for the given channels.
   * Called when mutation response has x-mutation-channels header.
   */
  getQueryKeysForChannels(channels: string[]): unknown[][] {
    const seenKeys = new Set<string>();
    const result: unknown[][] = [];

    for (const channel of channels) {
      const serializedKeys = this.queryKeyByChannel.get(channel);
      if (serializedKeys) {
        for (const serializedKey of serializedKeys) {
          // Deduplicate across channels
          if (!seenKeys.has(serializedKey)) {
            seenKeys.add(serializedKey);
            result.push(this.deserializeQueryKey(serializedKey));
          }
        }
      }
    }

    return result;
  }

  /**
   * Unregister a query key from all channels.
   * Called when a query is removed from the cache (garbage collected).
   */
  unregisterQueryKey(queryKey: unknown[]): void {
    const serializedKey = this.serializeQueryKey(queryKey);
    const channels = this.channelsByQueryKey.get(serializedKey);

    if (channels) {
      // Remove from all channel -> queryKeys maps
      for (const channel of channels) {
        const keys = this.queryKeyByChannel.get(channel);
        if (keys) {
          keys.delete(serializedKey);
          // Clean up empty channel entries
          if (keys.size === 0) {
            this.queryKeyByChannel.delete(channel);
          }
        }
      }

      // Remove reverse mapping
      this.channelsByQueryKey.delete(serializedKey);
    }
  }

  /**
   * Clear all mappings. Useful for testing or logout.
   */
  clear(): void {
    this.queryKeyByChannel.clear();
    this.channelsByQueryKey.clear();
  }

  /**
   * Get current state for debugging.
   */
  getDebugState(): {
    channelCount: number;
    queryKeyCount: number;
    mappings: Record<string, string[]>;
  } {
    const mappings: Record<string, string[]> = {};
    for (const [channel, keys] of this.queryKeyByChannel) {
      mappings[channel] = Array.from(keys);
    }

    return {
      channelCount: this.queryKeyByChannel.size,
      queryKeyCount: this.channelsByQueryKey.size,
      mappings,
    };
  }
}

/**
 * Singleton instance of the query channel store.
 * Used by tRPC links to register and look up query->channel mappings.
 */
export const queryChannelStore = new QueryChannelStore();
