import type { AppRouter } from '../routers';

/**
 * Helper to generate tRPC query keys in a type-safe way.
 * This ensures we're using the exact same key format that tRPC/React Query uses on the client.
 *
 * tRPC query keys follow the format: [path, ...segments, input?]
 * For example: ['organization', 'listAllPosts'] or ['organization', 'listPosts', { organizationId: '123' }]
 *
 * @example
 * getTRPCQueryKey('organization', 'listAllPosts')
 * getTRPCQueryKey('organization', 'listPosts', { organizationId: '123' })
 */

// Type-safe helper that ensures router and procedure paths exist in AppRouter
export function getTRPCQueryKey<
  TRouter extends keyof AppRouter & string,
  TProcedure extends keyof AppRouter[TRouter] & string,
>(
  router: TRouter,
  procedure: TProcedure,
  input?: any,
): readonly [TRouter, TProcedure, ...any[]] {
  if (input !== undefined) {
    return [router, procedure, input] as const;
  }
  return [router, procedure] as const;
}
