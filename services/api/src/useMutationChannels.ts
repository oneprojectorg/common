'use client';

import { queryChannelRegistry } from '@op/common/channels';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

/**
 * Hook that subscribes to channel mutation events and invalidates queries.
 *
 * Listens to the queryChannelRegistry for invalidation events and invalidates
 * the resolved query keys. The registry handles all the channel -> queryKey
 * resolution internally.
 *
 * Should be used once at the root level of your app.
 */
export function useMutationChannels(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    return queryChannelRegistry.subscribe((event) => {
      for (const queryKey of event.queryKeys) {
        queryClient.invalidateQueries({ queryKey });
      }
    });
  }, [queryClient]);
}
