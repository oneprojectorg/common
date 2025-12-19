'use client';

import type { RegistryEvents } from '@op/common/realtime';
import { queryChannelRegistry } from '@op/common/realtime';
import { QueryClientContext } from '@tanstack/react-query';
import { useCallback, useContext, useEffect, useRef } from 'react';

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
 * the affected query keys, and invalidates them. Tracks processed mutation IDs
 * to prevent duplicate invalidations.
 */
function useInvalidateQueries(): void {
  const queryClient = useRequiredQueryClient();
  const invalidatedMutationIds = useRef(new Set<string>());

  const handleMutationAdded = useCallback(
    ({ channels, mutationId }: RegistryEvents['mutation:added']) => {
      if (invalidatedMutationIds.current.has(mutationId)) {
        return;
      }
      invalidatedMutationIds.current.add(mutationId);

      const queryKeys = queryChannelRegistry.getQueryKeysForChannels(channels);

      for (const queryKey of queryKeys) {
        queryClient.invalidateQueries({ queryKey });
      }
    },
    [queryClient],
  );

  useEffect(() => {
    return queryChannelRegistry.on('mutation:added', handleMutationAdded);
  }, [handleMutationAdded]);
}
