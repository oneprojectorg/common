'use client';

import {
  queryChannelRegistry,
  readRealtimeChannelsMeta,
} from '@op/common/realtime';
import {
  HydrationBoundary as RQHydrationBoundary,
  type DehydratedState,
  type QueryClient,
  useQueryClient,
} from '@tanstack/react-query';
import type React from 'react';
import { useEffect } from 'react';

type HydrationBoundaryProps = React.ComponentProps<typeof RQHydrationBoundary>;

/**
 * React Query's HydrationBoundary, plus realtime channel registration.
 *
 * `hydrate` copies `meta` only onto queries it creates, so a query the cache
 * already holds would lose its channels; we read the incoming state instead of
 * the live cache.
 */
export function HydrationBoundary(props: HydrationBoundaryProps) {
  const { state } = props;
  const queryClient = useQueryClient(props.queryClient);

  useEffect(() => {
    registerHydratedChannels(state, queryClient);
  }, [state, queryClient]);

  return <RQHydrationBoundary {...props} />;
}

/**
 * Register every channel carried by a dehydrated state, under the query's real
 * cache key. Nothing unregisters here: the QueryCache `removed` event is the
 * teardown signal (see QueryInvalidationSubscriber).
 */
export function registerHydratedChannels(
  state: unknown,
  queryClient: QueryClient,
): void {
  const cache = queryClient.getQueryCache();

  for (const query of readDehydratedQueries(state)) {
    // Mirror `hydrate`: incoming state is applied only when it is newer than
    // what the cache holds, so an older boundary must not overwrite the
    // channels the live query registered with.
    const live = cache.get(query.queryHash);
    if (live && live.state.dataUpdatedAt > query.state.dataUpdatedAt) {
      continue;
    }

    const channels = readRealtimeChannelsMeta(query.meta);
    if (channels.length > 0) {
      queryChannelRegistry.registerQuery({
        queryKey: query.queryKey,
        channels,
      });
    }
  }
}

/**
 * `state` is typed as possibly undefined and arrives from the server, so read
 * the queries defensively.
 */
function readDehydratedQueries(state: unknown): DehydratedState['queries'] {
  if (typeof state !== 'object' || state === null) {
    return [];
  }

  const queries = Reflect.get(state, 'queries');
  if (!Array.isArray(queries)) {
    return [];
  }

  return queries.filter(
    (query): query is DehydratedState['queries'][number] =>
      typeof query === 'object' &&
      query !== null &&
      Array.isArray(Reflect.get(query, 'queryKey')) &&
      typeof Reflect.get(query, 'queryHash') === 'string' &&
      typeof Reflect.get(query, 'state') === 'object' &&
      Reflect.get(query, 'state') !== null,
  );
}
