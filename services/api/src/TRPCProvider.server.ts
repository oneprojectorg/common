import '@tanstack/react-start/server-only';
import { createServerSideHelpers } from '@trpc/react-query/server';
import superjson from 'superjson';

import { appRouter } from './routers';
import { createServerContext } from './serverClient';

export { dehydrate } from '@tanstack/react-query';

/**
 * Create server-side tRPC utils for prefetching data
 *
 * Use this in a server function to prefetch data that a route hydrates into
 * the client's React Query cache, preventing hydration mismatches between
 * server and client.
 *
 * @example
 * ```tsx
 * // posts.functions.ts
 * export const prefetchPosts = createServerFn().handler(async () => {
 *   const { utils, queryClient } = await createServerUtils();
 *   await utils.organization.listAllPosts.prefetchInfinite({ limit: 10 });
 *   return dehydrate(queryClient);
 * });
 *
 * // the route: `loader: () => prefetchPosts()`, then render the component
 * // inside <HydrationBoundary state={Route.useLoaderData()}> from
 * // @tanstack/react-query.
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
