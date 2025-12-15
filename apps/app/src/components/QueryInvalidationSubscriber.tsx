'use client';

import { ChannelName, queryChannelRegistry } from '@op/common/realtime';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

/**
 * Component that sets up realtime subscriptions based on mutation channel headers.
 */
export function QueryInvalidationSubscriber() {
  //  Must be rendered inside QueryClientProvider.
  //  TODO: add this check

  useInvalidateQueries();
  return null;
}

/**
 * Hook that subscribes to channel mutation events and invalidates queries.
 *
 * Listens to the queryChannelRegistry for mutation:added events, resolves
 * the affected query keys, and invalidates them.
 *
 * Should be used once at the root level of your app.
 */
export function useInvalidateQueries(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    return queryChannelRegistry.on(
      'mutation:added',
      ({ channels }: { channels: ChannelName[] }) => {
        const queryKeys =
          queryChannelRegistry.getQueryKeysForChannels(channels);

        for (const queryKey of queryKeys) {
          queryClient.invalidateQueries({ queryKey });
        }
      },
    );
  }, [queryClient]);
}
