'use client';

import { trpc } from '@op/api/client';
import type { ChannelName, RegistryEvents } from '@op/common/realtime';
import { queryChannelRegistry } from '@op/common/realtime';
import { RealtimeManager } from '@op/realtime/client';
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
 * Listens to the queryChannelRegistry for:
 * - query:added: Subscribes to WebSocket channels when queries register
 * - mutation:added: Invalidates queries when mutations occur
 *
 * Also handles WebSocket messages for server-initiated invalidations.
 */
function useInvalidateQueries(): void {
  const queryClient = useRequiredQueryClient();
  const invalidatedMutationIds = useRef(new Set<string>());
  const utils = trpc.useUtils();
  const unsubscribersRef = useRef<Map<ChannelName, () => void>>(new Map());
  const initializedRef = useRef(false);

  // Store refs to avoid effect re-runs
  const queryClientRef = useRef(queryClient);
  const utilsRef = useRef(utils);
  queryClientRef.current = queryClient;
  utilsRef.current = utils;

  const handleInvalidation = useCallback(
    async ({ channels, mutationId }: RegistryEvents['mutation:added']) => {
      if (invalidatedMutationIds.current.has(mutationId)) {
        return;
      }
      invalidatedMutationIds.current.add(mutationId);

      const queryKeys = queryChannelRegistry.getQueryKeysForChannels(channels);

      for (const queryKey of queryKeys) {
        await queryClientRef.current.invalidateQueries({ queryKey });
      }
    },
    [],
  );

  /**
   * Handle local mutation events - invalidate queries subscribed to affected channels
   */
  useEffect(() => {
    const unsubscribeMutationAdded = queryChannelRegistry.on(
      'mutation:added',
      handleInvalidation,
    );

    return () => {
      unsubscribeMutationAdded();
    };
  }, [handleInvalidation]);

  /**
   * Subscribe to WebSocket channel when a query registers interest in channels
   */
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_CENTRIFUGO_WS_URL;

    // Skip realtime subscriptions entirely if WebSocket URL is not configured
    if (!wsUrl) {
      return;
    }

    // Initialize RealtimeManager only once
    if (!initializedRef.current) {
      RealtimeManager.initialize({
        wsUrl,
        getToken: async () => {
          const { token } = await utilsRef.current.realtime.getToken.fetch();
          return token;
        },
      });
      initializedRef.current = true;
    }

    const realtimeManager = RealtimeManager.getInstance();

    const unsubscribeQueryAdded = queryChannelRegistry.on(
      'query:added',
      ({ channels }: RegistryEvents['query:added']) => {
        for (const channel of channels) {
          if (unsubscribersRef.current.has(channel)) {
            continue;
          }

          const unsubscribe = realtimeManager.subscribe(
            channel,
            ({ channel, data }) =>
              handleInvalidation({
                channels: [channel],
                mutationId: data.mutationId,
              }),
          );
          unsubscribersRef.current.set(channel, unsubscribe);
        }
      },
    );

    return () => {
      unsubscribeQueryAdded();

      // Clean up all WebSocket subscriptions
      for (const unsubscribe of unsubscribersRef.current.values()) {
        unsubscribe();
      }
      unsubscribersRef.current.clear();
    };
  }, [handleInvalidation]);
}
