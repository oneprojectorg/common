/**
 * Cached server-side tRPC query utilities.
 *
 * These helpers wrap tRPC server calls in Next.js `use cache` boundaries,
 * tagged with the same channel names used by the Realtime invalidation
 * system.  When a mutation fires, `withChannelMeta` both publishes to
 * Supabase Realtime (client-side React Query invalidation) AND hits
 * `/api/revalidate` with the same channel names (server-side Next.js
 * cache invalidation).
 *
 * ## Important: `cookies()` / `headers()` cannot be called inside `use cache`.
 *
 * `createClient()` from `@op/api/serverClient` reads cookies internally,
 * so it cannot be invoked directly inside a `use cache` function. Instead:
 *
 * 1. Read dynamic values (cookies, headers) in the server component.
 * 2. Pass them as arguments to the cached function.
 *
 * The cache key is automatically derived from the function reference +
 * its arguments, so different users get distinct cache entries.
 *
 * @example
 * ```tsx
 * // In a Server Component:
 * import { cookies } from 'next/headers';
 * import { cachedServerQuery } from '@/utils/cachedServerQuery';
 *
 * export default async function DecisionPage({ params }) {
 *   const { slug } = await params;
 *   const cookieHeader = await getCookieHeader();
 *
 *   const decision = await getDecision(cookieHeader, slug);
 *   // ...render
 * }
 *
 * async function getDecision(cookieHeader: string, slug: string) {
 *   'use cache';
 *   cacheTag(`decision:${slug}`);
 *   cacheLife('hours');
 *
 *   const client = createAuthenticatedCaller(cookieHeader);
 *   return client.decision.getDecisionBySlug({ slug });
 * }
 * ```
 */

import { cacheTag, cacheLife } from 'next/cache';
import { cookies } from 'next/headers';

/**
 * Read the raw Cookie header string from the incoming request.
 * Call this **outside** any `use cache` boundary, then pass the
 * result into your cached function.
 */
export async function getCookieHeader(): Promise<string> {
  const cookieStore = await cookies();
  return cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}

export { cacheTag, cacheLife };
