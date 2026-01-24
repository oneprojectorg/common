'use client';

/**
 * New tRPC integration using @trpc/tanstack-react-query
 *
 * This provides native TanStack Query hooks that can be used alongside
 * TanStack DB collections. Unlike the classic integration (@trpc/react-query),
 * this returns query options that you pass to native useQuery/useSuspenseQuery.
 *
 * @example
 * ```tsx
 * import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
 * import { trpcOptions } from '@op/api/trpcTanstackQuery';
 *
 * // Query
 * const { data } = useQuery(trpcOptions.platform.getStats.queryOptions());
 *
 * // Suspense Query
 * const { data } = useSuspenseQuery(trpcOptions.platform.admin.listAllUsers.queryOptions({ limit: 10 }));
 *
 * // Mutations use useMutation hook
 * const mutation = useMutation(trpcOptions.platform.admin.updateUserProfile.mutationOptions());
 * ```
 */
import { TRPCClientError, createTRPCClient } from '@trpc/client';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';

import { queryClient } from './TRPCProvider';
import { links } from './links';
import type { AppRouter } from './routers';

/**
 * Vanilla tRPC client for the new integration
 */
export const trpcClient = createTRPCClient<AppRouter>({
  links,
});

/**
 * tRPC options proxy - use this to generate query/mutation options
 * for native TanStack Query hooks
 *
 * Note: This uses the same queryClient instance from TRPCProvider to ensure
 * cache consistency between the classic and new tRPC integrations.
 */
export const trpcOptions = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});

export type RouterInput = inferRouterInputs<AppRouter>;
export type RouterOutput = inferRouterOutputs<AppRouter>;

export function isTRPCClientError(
  cause: unknown,
): cause is TRPCClientError<AppRouter> {
  return cause instanceof TRPCClientError;
}
