'use client';

import type { ChannelName, RealtimeMessage } from '@op/realtime';
import { RealtimeManager } from '@op/realtime';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

import { mutationChannelsStore } from './mutationChannelsStore';

/**
 * Hook that subscribes to realtime channels based on mutation channel headers
 * received from tRPC queries. It automatically:
 * 1. Listens for new channels from tRPC responses
 * 2. Subscribes to those channels via the RealtimeManager
 * 3. Invalidates queries when receiving invalidation messages
 *
 * Should be used once at the root level of your app.
 */
export function useMutationChannels() {
  const queryClient = useQueryClient();
  const subscribedChannels = useRef(new Set<ChannelName>());
  const unsubscribeFns = useRef(new Map<ChannelName, () => void>());

  // Handler for realtime messages - invalidates queries
  const handleRealtimeMessage = useCallback(
    (message: RealtimeMessage) => {
      if (message.type === 'query-invalidation') {
        queryClient.invalidateQueries({
          queryKey: message.queryKey as string[],
        });
      }
    },
    [queryClient],
  );

  // Subscribe to a channel if not already subscribed
  const subscribeToChannel = useCallback(
    (channel: ChannelName) => {
      if (subscribedChannels.current.has(channel)) {
        return; // Already subscribed
      }

      try {
        const unsubscribe = RealtimeManager.getInstance().subscribe(
          channel,
          handleRealtimeMessage,
        );
        subscribedChannels.current.add(channel);
        unsubscribeFns.current.set(channel, unsubscribe);
      } catch (error) {
        // RealtimeManager not initialized yet - this is OK, will retry on next channel
        console.warn(
          '[useMutationChannels] RealtimeManager not initialized:',
          error,
        );
      }
    },
    [handleRealtimeMessage],
  );

  useEffect(() => {
    // Subscribe to channels already in the store
    const existingChannels = mutationChannelsStore.getChannels();
    for (const channel of existingChannels) {
      subscribeToChannel(channel);
    }

    // Listen for new channels
    const unsubscribeStore = mutationChannelsStore.subscribe((newChannels) => {
      for (const channel of newChannels) {
        subscribeToChannel(channel);
      }
    });

    // Cleanup on unmount
    return () => {
      unsubscribeStore();
      // Unsubscribe from all channels
      for (const unsubscribe of unsubscribeFns.current.values()) {
        unsubscribe();
      }
      subscribedChannels.current.clear();
      unsubscribeFns.current.clear();
    };
  }, [subscribeToChannel]);
}
