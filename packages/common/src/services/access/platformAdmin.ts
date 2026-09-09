import { cache } from '@op/cache';
import { db, eq } from '@op/db/client';
import { users } from '@op/db/schema';
import { z } from 'zod';

import { ValidationError } from '../../utils/error';

/**
 * Platform admin ("Django `is_superuser`") lives on `users.isPlatformAdmin`.
 * It is a platform-wide grant — access to `/admin` and every
 * `withAuthenticatedPlatformAdmin` procedure — and is unrelated to the
 * org-level `Admin` access role, which is scoped to one organization.
 *
 * This module is read-only on purpose: nothing in the application writes the
 * flag. It is granted and revoked by an operator with database access.
 * See `docs/adr/0005-store-platform-admin-as-a-users-flag.md`.
 *
 * Two reads, deliberately separate:
 *
 *   - {@link isPlatformAdmin} — uncached, read-through to the row. This is the
 *     authorization gate, and an authorization gate must not be able to admit
 *     someone on the strength of a stale cache entry that nothing can
 *     invalidate. The admin surface is small and rarely hit, so a
 *     single-column indexed lookup per request is the right price.
 *   - {@link isPlatformAdminCached} — the same read behind a short TTL, for the
 *     hot path (`account.getMyAccount`) where the answer only decides whether
 *     the admin layout renders or 404s. That surface may lag by up to
 *     {@link PLATFORM_ADMIN_CACHE_TTL_MS}; the API gate behind it does not.
 */

// Cached as a wrapper object rather than a bare boolean: `cache()` only writes
// truthy values through to Redis, so `false` would never be stored and every
// non-admin's request would hit the DB.
type PlatformAdminFlag = { isPlatformAdmin: boolean };

/**
 * Five minutes, against the 72h default. Nothing in the app can invalidate this
 * entry — the flag changes by direct SQL — so the TTL *is* the propagation
 * delay for both a grant and a revocation on the cached path.
 */
export const PLATFORM_ADMIN_CACHE_TTL_MS = 5 * 60 * 1000;

const authUserIdSchema = z.uuid('Invalid authentication user ID format');

/**
 * Validate and canonicalise the id. Lowercased after validation so the cache
 * key and the query can never diverge on casing: Postgres compares `uuid`
 * values canonically, but a cache key is a string and `A1B2…` and `a1b2…` would
 * be two entries for one user.
 */
const parseAuthUserId = (authUserId: string): string => {
  const parsed = authUserIdSchema.safeParse(authUserId);

  if (!parsed.success) {
    throw new ValidationError('Invalid authentication user ID format');
  }

  return parsed.data.toLowerCase();
};

/** The narrow read: just the flag, keyed by auth user id. */
const selectPlatformAdminFlag = async (
  authUserId: string,
): Promise<PlatformAdminFlag> => {
  const [row] = await db
    .select({ isPlatformAdmin: users.isPlatformAdmin })
    .from(users)
    .where(eq(users.authUserId, authUserId))
    .limit(1);

  return { isPlatformAdmin: row?.isPlatformAdmin ?? false };
};

/**
 * Whether the caller is a platform admin, read straight from the `users` row.
 * Use this for authorization (`withAuthenticatedPlatformAdmin`).
 *
 * A missing `users` row answers `false` rather than throwing: the caller is
 * authenticated but has no platform grant, which is the same answer.
 */
export const isPlatformAdmin = async ({
  authUserId,
}: {
  authUserId: string;
}): Promise<boolean> => {
  const { isPlatformAdmin: flag } = await selectPlatformAdminFlag(
    parseAuthUserId(authUserId),
  );

  return flag;
};

/**
 * {@link isPlatformAdmin} behind a {@link PLATFORM_ADMIN_CACHE_TTL_MS} cache
 * entry. Only for surfaces that are hot and merely presentational — today
 * `account.getMyAccount`, which drives the `/admin` layout's 404. Never for an
 * authorization decision.
 */
export const isPlatformAdminCached = async ({
  authUserId,
}: {
  authUserId: string;
}): Promise<boolean> => {
  const validatedAuthUserId = parseAuthUserId(authUserId);

  const flag = await cache<PlatformAdminFlag>({
    type: 'platformAdmin',
    params: [validatedAuthUserId],
    fetch: () => selectPlatformAdminFlag(validatedAuthUserId),
    options: {
      ttl: PLATFORM_ADMIN_CACHE_TTL_MS,
    },
  });

  return flag.isPlatformAdmin;
};
