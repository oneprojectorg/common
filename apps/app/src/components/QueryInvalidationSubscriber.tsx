'use client';

import type { ChannelName } from '@op/common/realtime';
import { queryChannelRegistry } from '@op/common/realtime';
import { QueryClientContext } from '@tanstack/react-query';
import { useContext, useEffect } from 'react';

/**
 * Returns the QueryClient if inside a QueryClientProvider, throws a descriptive error otherwise.
 */
function useRequiredQueryClient() {
  const queryClient = useContext(QueryClientContext);
  if (!queryClient) {
    throw new Error(
      'QueryInvalidationSubscriber must be rendered inside a QueryClientProvider',
    );
  }
  return queryClient;
}

/**
 * Component that sets up realtime subscriptions based on mutation channel headers.
 * Must be rendered inside QueryClientProvider.
 */
export function QueryInvalidationSubscriber() {
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
  const queryClient = useRequiredQueryClient();

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
