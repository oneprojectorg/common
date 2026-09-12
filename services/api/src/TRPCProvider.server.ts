import type {
  DehydrateOptions,
  DehydratedState,
  QueryClient,
} from '@tanstack/react-query';
import { dehydrate as dehydrateQueryClient } from '@tanstack/react-query';
import { createServerSideHelpers } from '@trpc/react-query/server';
import { cache } from 'react';
import superjson from 'superjson';

import type { ChannelRecords } from './channelHydration';
import {
  createChannelRecords,
  decorateDehydratedState,
  recordQueryChannels,
} from './channelHydration';
import { appRouter } from './routers';
import { createServerContext } from './serverClient';
import type { TContext } from './types';

export { HydrationBoundary } from './HydrationBoundary';

/**
 * Channels recorded by each render's prefetches, reachable from `dehydrate`
 * through the QueryClient it is handed. Weak so a finished render's records go
 * with its QueryClient.
 */
const channelRecords = new WeakMap<QueryClient, ChannelRecords>();

/**
 * Create server-side tRPC utils for prefetching data
 *
 * Use this in Server Components to prefetch data that will be
 * hydrated into the client's React Query cache, preventing
 * hydration mismatches between server and client.
 *
 * @example
 * ```tsx
 * import { createServerUtils, dehydrate, HydrationBoundary } from '@op/api/server';
 *
 * const MyServerComponent = async () => {
 *   const { utils, queryClient } = await createServerUtils();
 *   await utils.organization.listAllPosts.prefetchInfinite({ limit: 10 });
 *
 *   return (
 *     <HydrationBoundary state={dehydrate(queryClient)}>
 *       <ClientComponent />
 *     </HydrationBoundary>
 *   );
 * };
 * ```
 */
export const createServerUtils = cache(async () => {
  const baseCtx = await createServerContext();
  const records: ChannelRecords = createChannelRecords();

  // Copy rather than mutate: the base context is `cache()`d and shared with
  // `createClient()`, which must not pick up this render's recorder.
  const ctx: TContext = {
    ...baseCtx,
    onQueryChannels: (entry) => recordQueryChannels(records, entry),
  };

  const helpers = createServerSideHelpers({
    router: appRouter,
    ctx,
    transformer: superjson,
  });

  channelRecords.set(helpers.queryClient, records);

  return { utils: helpers, queryClient: helpers.queryClient };
});

/**
 * Dehydrate a prefetching QueryClient, tagging each query with the realtime
 * channels it resolved with so the client can register them on hydration
 * without a round trip. Otherwise React Query's `dehydrate`.
 */
export const dehydrate = (
  queryClient: QueryClient,
  options?: DehydrateOptions,
): DehydratedState => {
  const state = dehydrateQueryClient(queryClient, options);
  const records = channelRecords.get(queryClient);

  return records ? decorateDehydratedState(state, records) : state;
};
