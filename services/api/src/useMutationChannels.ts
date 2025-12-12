'use client';

import { queryChannelRegistry } from '@op/common/channels';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

/**
 * Hook that subscribes to channel mutation events and invalidates queries.
 *
 * Listens to the queryChannelRegistry for mutation:added events, resolves
 * the affected query keys, and invalidates them.
 *
 * Should be used once at the root level of your app.
 */
export function useMutationChannels(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    return queryChannelRegistry.on('mutation:added', ({ channels }) => {
      const queryKeys = queryChannelRegistry.getQueryKeysForChannels(channels);
      for (const queryKey of queryKeys) {
        queryClient.invalidateQueries({ queryKey });
      }
    });
  }, [queryClient]);
}
