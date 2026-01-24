'use client';

import { trpc } from '@op/api/client';
import { Channels } from '@op/common/realtime';
import { RealtimeManager } from '@op/realtime/client';
import { useEffect, useRef } from 'react';

/**
 * Hook that subscribes to a poll's realtime channel and invalidates
 * the poll query when updates (votes, close events) are received.
 *
 * @param pollId - The poll ID to subscribe to
 */
export function usePollSubscription(pollId: string | undefined): void {
  const utils = trpc.useUtils();
  const processedMutationIds = useRef(new Set<string>());

  useEffect(() => {
    if (!pollId) {
      return;
    }

    const wsUrl = process.env.NEXT_PUBLIC_CENTRIFUGO_WS_URL;

    // Skip subscription if WebSocket URL is not configured
    if (!wsUrl) {
      return;
    }

    const realtimeManager = RealtimeManager.getInstance();
    const channel = Channels.poll(pollId);

    const unsubscribe = realtimeManager.subscribe(channel, ({ data }) => {
      // Deduplicate messages by mutationId
      if (processedMutationIds.current.has(data.mutationId)) {
        return;
      }
      processedMutationIds.current.add(data.mutationId);

      // Invalidate the poll query to refetch fresh data
      utils.polls.get.invalidate({ pollId });
    });

    return () => {
      unsubscribe();
    };
  }, [pollId, utils.polls.get]);
}
