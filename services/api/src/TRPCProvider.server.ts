import { createServerSideHelpers } from '@trpc/react-query/server';
import superjson from 'superjson';

import { appRouter } from './routers';
import { createServerContext } from './serverClient';

export { dehydrate, HydrationBoundary } from '@tanstack/react-query';

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
export const createServerUtils = async () => {
  const ctx = await createServerContext();

  const helpers = createServerSideHelpers({
    router: appRouter,
    ctx,
    transformer: superjson,
  });

  return { utils: helpers, queryClient: helpers.queryClient };
};
