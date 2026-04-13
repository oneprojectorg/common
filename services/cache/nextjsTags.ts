import { OPURLConfig } from '@op/core';
import { logger } from '@op/logging';

const REVALIDATION_SECRET = process.env.REVALIDATION_SECRET;

/**
 * Revalidate Next.js cache tags by calling the app's `/api/revalidate` endpoint.
 *
 * This bridges the API server → Next.js app boundary: when a tRPC mutation
 * publishes channels to Supabase Realtime (for client-side React Query
 * invalidation), the same channel names are sent here as cache tags so the
 * Next.js Data Cache is invalidated too.
 *
 * Tags correspond 1-to-1 with Realtime channel names (e.g. "org:abc",
 * "decisionInstance:123") so both systems share a single naming convention.
 *
 * The call is fire-and-forget (best-effort) — a failure here only means the
 * Next.js cache will serve stale data until its TTL expires or the next
 * deployment.
 */
export async function revalidateNextjsCacheTags(
  tags: string[],
): Promise<void> {
  if (tags.length === 0) {
    return;
  }

  if (!REVALIDATION_SECRET) {
    return;
  }

  const appUrl = OPURLConfig('APP').ENV_URL;

  if (!appUrl) {
    return;
  }

  try {
    const response = await fetch(`${appUrl}/api/revalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-revalidation-secret': REVALIDATION_SECRET,
      },
      body: JSON.stringify({ tags }),
    });

    if (!response.ok) {
      logger.error('Failed to revalidate Next.js cache tags', {
        status: response.status,
        tags,
      });
    }
  } catch (error) {
    logger.error('Error revalidating Next.js cache tags', { error, tags });
  }
}
