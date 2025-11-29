'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { initializeQueryInvalidation } from './links';

/**
 * Hook that initializes channel-based query invalidation.
 *
 * Initializes the query channel store with a reference to queryClient
 * for immediate (header-based) invalidation on the current client.
 *
 * Should be used once at the root level of your app.
 */
export function useMutationChannels() {
  const queryClient = useQueryClient();

  useEffect(() => {
    initializeQueryInvalidation(queryClient);
  }, [queryClient]);
}
