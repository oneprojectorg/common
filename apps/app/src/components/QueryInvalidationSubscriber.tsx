'use client';

import type { ChannelName, RegistryEvents } from '@op/common/realtime';
import { queryChannelRegistry } from '@op/common/realtime';
import { RealtimeManager } from '@op/realtime/client';
import { createSBBrowserClient } from '@op/supabase/client';
import { QueryClientContext } from '@tanstack/react-query';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';

const MAX_INVALIDATED_IDS = 500;

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
 * True once a Supabase session exists (anonymous or full), read from the
 * browser client's local storage — no network or DB — and kept live via
 * onAuthStateChange so realtime flips on at login and off at logout.
 */
function useHasSession(): boolean {
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const supabase = createSBBrowserClient();
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setHasSession(Boolean(data.session));
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(Boolean(session));
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return hasSession;
}

/**
 * Component that sets up realtime subscriptions based on mutation channel headers.
 * Must be rendered inside QueryClientProvider.
 *
 * Gates the WebSocket to signed-in users; others still get local cache
 * invalidation for their own mutations.
 */
export function QueryInvalidationSubscriber() {
  useInvalidateQueries(useHasSession());
  return null;
}

/**
 * Hook that subscribes to channel mutation events and invalidates queries.
 *
 * Listens to the queryChannelRegistry for:
 * - query:added: Subscribes to WebSocket channels when queries register
 * - channel:removed: Unsubscribes WebSocket channels when the last query drops
 * - mutation:added: Invalidates queries when mutations occur
 *
 * Also forwards TanStack QueryCache 'removed' events to the registry so
 * per-channel refcounts decrement, and bounds the mutation-id dedup cache.
 */
function useInvalidateQueries(enabled: boolean): void {
  const queryClient = useRequiredQueryClient();
  const invalidatedMutationIds = useRef<Map<string, true>>(new Map());
  const unsubscribersRef = useRef<Map<ChannelName, () => void>>(new Map());
  const initializedRef = useRef(false);

  // Store refs to avoid effect re-runs
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  const handleInvalidation = useCallback(
    async ({ channels, mutationId }: RegistryEvents['mutation:added']) => {
      const seen = invalidatedMutationIds.current;
      if (seen.has(mutationId)) {
        return;
      }
      seen.set(mutationId, true);
      if (seen.size > MAX_INVALIDATED_IDS) {
        const oldest = seen.keys().next().value;
        if (oldest !== undefined) {
          seen.delete(oldest);
        }
      }

      const queryKeys = queryChannelRegistry.getQueryKeysForChannels(channels);

      await Promise.allSettled(
        queryKeys.map((queryKey) =>
          queryClientRef.current.invalidateQueries({ queryKey }),
        ),
      );
    },
    [],
  );

  /**
   * Re-read a channel's queries once its socket join is confirmed.
   *
   * Broadcasts are not replayed, so anything published before the join landed
   * is gone: on a first subscribe that is the gap between a query answering and
   * its channel going live, and after a dropped connection it is everything
   * that happened while the socket was down. Nothing else recovers either —
   * without this, a reconnected tab keeps showing whatever it held when the
   * connection died until something unrelated invalidates it.
   *
   * No mutation id to deduplicate against here, and none wanted: two joins are
   * two separate gaps to close, not a message delivered twice.
   */
  const handleChannelSubscribed = useCallback(
    async ({ channel }: RegistryEvents['channel:subscribed']) => {
      const queryKeys = queryChannelRegistry.getQueryKeysForChannels([channel]);

      await Promise.allSettled(
        queryKeys.map((queryKey) =>
          queryClientRef.current.invalidateQueries({ queryKey }),
        ),
      );
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
    const unsubscribeChannelSubscribed = queryChannelRegistry.on(
      'channel:subscribed',
      handleChannelSubscribed,
    );

    return () => {
      unsubscribeMutationAdded();
      unsubscribeChannelSubscribed();
    };
  }, [handleInvalidation, handleChannelSubscribed]);

  /**
   * Forward QueryCache 'removed' events to the registry so per-channel
   * refcounts decrement when TanStack garbage-collects a query.
   */
  useEffect(() => {
    const cache = queryClient.getQueryCache();
    const unsubscribeCache = cache.subscribe((event) => {
      if (event.type === 'removed') {
        queryChannelRegistry.unregisterQuery({
          queryKey: event.query.queryKey,
        });
      }
    });

    return () => {
      unsubscribeCache();
    };
  }, [queryClient]);

  /**
   * Subscribe to WebSocket channel when a query registers interest in channels,
   * and tear it down when the registry reports the channel has no more queries.
   */
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Skip realtime subscriptions entirely if Supabase config is not available
    if (!supabaseUrl || !supabaseAnonKey) {
      return;
    }

    // Initialize RealtimeManager only once
    if (!initializedRef.current) {
      RealtimeManager.initialize({
        supabaseUrl,
        supabaseAnonKey,
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
            // Reported so every query on this channel re-reads once it is
            // genuinely live — see `handleChannelSubscribed`. Fires again on a
            // rejoin after the connection drops, which is the only thing that
            // recovers what was broadcast while the socket was down.
            () => queryChannelRegistry.notifyChannelSubscribed(channel),
          );
          unsubscribersRef.current.set(channel, unsubscribe);
        }
      },
    );

    const unsubscribeChannelRemoved = queryChannelRegistry.on(
      'channel:removed',
      ({ channel }: RegistryEvents['channel:removed']) => {
        const unsubscribe = unsubscribersRef.current.get(channel);
        if (unsubscribe) {
          unsubscribe();
          unsubscribersRef.current.delete(channel);
        }
      },
    );

    return () => {
      unsubscribeQueryAdded();
      unsubscribeChannelRemoved();

      // Clean up all WebSocket subscriptions
      for (const unsubscribe of unsubscribersRef.current.values()) {
        unsubscribe();
      }
      unsubscribersRef.current.clear();
    };
  }, [handleInvalidation, enabled]);
}
