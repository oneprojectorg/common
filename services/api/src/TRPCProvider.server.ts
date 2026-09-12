import { QueryClient } from '@tanstack/react-query';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import { cache } from 'react';

import { appRouter } from './routers';
import { createServerContext } from './serverClient';

export { dehydrate, HydrationBoundary } from '@tanstack/react-query';

/**
 * One `QueryClient` per request. `cache()` scopes it to the React request, so
 * two concurrent SSR renders never see each other's data.
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
