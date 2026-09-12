import { QueryClient } from '@tanstack/react-query';
import { createServerSideHelpers } from '@trpc/react-query/server';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import { cache } from 'react';
import superjson from 'superjson';

import { appRouter } from './routers';
import { createServerContext } from './serverClient';

export { dehydrate, HydrationBoundary } from '@tanstack/react-query';

/**
 * One `QueryClient` per request, shared by the classic helpers and the
 * `@trpc/tanstack-react-query` proxy below. `cache()` scopes it to the React
 * request, so two concurrent SSR renders never see each other's data.
 *
 * Both mechanisms write the same cache keys (no `keyPrefix` — see
 * `TRPCProvider.tsx`), so a page part-way through the migration can seed with
 * either and `dehydrate()` once.
 */
const getServerQueryClient = cache(() => new QueryClient());

/**
 * Server-side tRPC options proxy for seeding data into the client's React
 * Query cache.
 *
 * Procedures are called in-process (no HTTP, no links), exactly as
 * `createServerUtils` did. `ctx.isServerSideCall` is set, so `withChannelMeta`
 * neither wraps the response nor publishes — the value you get back is the
 * plain procedure output.
 *
 * @example
 * ```tsx
 * import { HydrationBoundary, createServerTRPC, dehydrate } from '@op/api/server';
 *
 * const MyServerComponent = async () => {
 *   const { trpc, queryClient } = await createServerTRPC();
 *   await queryClient.prefetchInfiniteQuery(
 *     trpc.organization.listAllPosts.infiniteQueryOptions({ limit: 10 }),
 *   );
 *
 *   return (
 *     <HydrationBoundary state={dehydrate(queryClient)}>
 *       <ClientComponent />
 *     </HydrationBoundary>
 *   );
 * };
 * ```
 */
export const createServerTRPC = cache(async () => {
  const ctx = await createServerContext();
  const queryClient = getServerQueryClient();

  const trpc = createTRPCOptionsProxy({
    router: appRouter,
    ctx,
    queryClient,
  });

  return { trpc, queryClient };
});

/**
 * Create server-side tRPC utils for prefetching data
 *
 * @deprecated Use {@link createServerTRPC}. This is the classic
 * `@trpc/react-query` helper, kept only until the remaining call sites move
 * over; it shares `createServerTRPC`'s `QueryClient`.
 */
export const createServerUtils = cache(async () => {
  const ctx = await createServerContext();
  const queryClient = getServerQueryClient();

  const helpers = createServerSideHelpers({
    router: appRouter,
    ctx,
    transformer: superjson,
    queryClient,
  });

  return { utils: helpers, queryClient };
});
