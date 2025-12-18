'use client';

import { trpc } from '@op/api/client';
import type { ChannelName, RegistryEvents } from '@op/common/realtime';
import { queryChannelRegistry } from '@op/common/realtime';
import { RealtimeManager, type RealtimeMessage } from '@op/realtime/client';
import { QueryClientContext } from '@tanstack/react-query';
import { useContext, useEffect, useRef } from 'react';

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
  const utils = trpc.useUtils();
  const invalidatedRequestIds = new Set<string>();
  const unsubscribersRef = useRef<Map<ChannelName, () => void>>(new Map());
  const initializedRef = useRef(false);

  // Store refs to avoid effect re-runs
  const queryClientRef = useRef(queryClient);
  const utilsRef = useRef(utils);
  queryClientRef.current = queryClient;
  utilsRef.current = utils;

  useEffect(() => {
    // Initialize RealtimeManager only once
    if (!initializedRef.current) {
      const wsUrl = process.env.NEXT_PUBLIC_CENTRIFUGO_WS_URL;
      if (wsUrl) {
        RealtimeManager.initialize({
          wsUrl,
          getToken: async () => {
            const { token } = await utilsRef.current.realtime.getToken.fetch();
            return token;
          },
        });
      }
      initializedRef.current = true;
    }

    const realtimeManager = RealtimeManager.getInstance();

    /**
     * Handle realtime messages - invalidate queries based on message type
     */
    const handleRealtimeMessage = ({
      channel,
      data,
    }: {
      channel: ChannelName;
      data: RealtimeMessage;
    }) => {
      const { mutationId } = data;

      if (mutationId && invalidatedRequestIds.has(mutationId)) {
        console.log(
          '[Realtime] Skipping already processed mutation - centrifugo',
          { mutationId },
        );
        // Already processed this mutation event
        return;
      }

      // Invalidate queries for this channel
      const queryKeys = queryChannelRegistry.getQueryKeysForChannels([channel]);

      for (const queryKey of queryKeys) {
        queryClientRef.current.invalidateQueries({ queryKey });
      }

      if (mutationId) {
        invalidatedRequestIds.add(mutationId);
      }
    };

    /**
     * Subscribe to WebSocket channel when a query registers interest in channels
     */
    const offSubscriptionAdded = queryChannelRegistry.on(
      'query:added',
      ({ channels }: { queryKey: unknown; channels: ChannelName[] }) => {
        for (const channel of channels) {
          // Skip if already subscribed to this channel
          if (unsubscribersRef.current.has(channel)) {
            continue;
          }

          const unsubscribe = realtimeManager.subscribe(
            channel,
            handleRealtimeMessage,
          );
          unsubscribersRef.current.set(channel, unsubscribe);
        }
      },
    );

    /**
     * Handle local mutation events - invalidate queries subscribed to affected channels
     */
    const offMutationAdded = queryChannelRegistry.on(
      'mutation:added',
      ({ channels, mutationId }: RegistryEvents['mutation:added']) => {
        if (mutationId && invalidatedRequestIds.has(mutationId)) {
          console.log('[Realtime] Skipping already processed mutation - api', {
            mutationId,
          });
          // Already processed this mutation event
          return;
        }

        const queryKeys =
          queryChannelRegistry.getQueryKeysForChannels(channels);

        for (const queryKey of queryKeys) {
          queryClientRef.current.invalidateQueries({ queryKey });
        }

        if (mutationId) {
          invalidatedRequestIds.add(mutationId);
        }
      },
    );

    return () => {
      offSubscriptionAdded();
      offMutationAdded();

      // Clean up all WebSocket subscriptions
      for (const unsubscribe of unsubscribersRef.current.values()) {
        unsubscribe();
      }
      unsubscribersRef.current.clear();
    };
  }, []);
}
