import type { ChannelName } from '@op/realtime';

import { MUTATION_CHANNELS_HEADER } from './trpcFactory';

type MutationChannelsListener = (channels: ChannelName[]) => void;

/**
 * Simple observable store for mutation channels received from tRPC responses.
 * This allows the link to communicate channels to React components.
 */
class MutationChannelsStore {
  private channels = new Set<ChannelName>();
  private listeners = new Set<MutationChannelsListener>();

  /**
   * Add channels received from a tRPC response.
   * Notifies listeners if new channels are added.
   */
  addChannels(newChannels: ChannelName[]) {
    const addedChannels: ChannelName[] = [];

    for (const channel of newChannels) {
      if (!this.channels.has(channel)) {
        this.channels.add(channel);
        addedChannels.push(channel);
      }
    }

    if (addedChannels.length > 0) {
      this.notifyListeners(addedChannels);
    }
  }

  /**
   * Get all currently tracked channels.
   */
  getChannels(): ChannelName[] {
    return Array.from(this.channels);
  }

  /**
   * Subscribe to new channel additions.
   * Returns an unsubscribe function.
   */
  subscribe(listener: MutationChannelsListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(newChannels: ChannelName[]) {
    for (const listener of this.listeners) {
      listener(newChannels);
    }
  }

  /**
   * Clear all channels (useful for logout/cleanup).
   */
  clear() {
    this.channels.clear();
  }
}

export const mutationChannelsStore = new MutationChannelsStore();

/**
 * Extract mutation channels from a fetch response.
 * Call this from the custom fetch function in tRPC links.
 */
export function extractMutationChannels(response: Response) {
  const header = response.headers.get(MUTATION_CHANNELS_HEADER);
  if (header) {
    const channels = header.split(',').filter(Boolean) as ChannelName[];
    mutationChannelsStore.addChannels(channels);
  }
}
