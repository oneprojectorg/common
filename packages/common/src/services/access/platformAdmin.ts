import { cache, invalidate } from '@op/cache';
import { and, count, db, eq, ne } from '@op/db/client';
import { users } from '@op/db/schema';
import { logger } from '@op/logging';
import { z } from 'zod';

import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils/error';

/**
 * Platform admin ("Django `is_superuser`") lives on `users.isPlatformAdmin`.
 * It is a platform-wide grant — access to `/admin` and every
 * `withAuthenticatedPlatformAdmin` procedure — and is unrelated to the
 * org-level `Admin` access role, which is scoped to one organization.
 *
 * See `docs/adr/0005-store-platform-admin-as-a-users-flag.md`.
 */

// Flag reads sit in front of every admin request, so they are cached. Cached as
// a wrapper object rather than a bare boolean: `cache()` only writes truthy
// values through to Redis, so `false` would never be stored and every
// non-admin's request would hit the DB.
type PlatformAdminFlag = { isPlatformAdmin: boolean };

const authUserIdSchema = z.uuid('Invalid authentication user ID format');

const parseAuthUserId = (authUserId: string): string => {
  const parsed = authUserIdSchema.safeParse(authUserId);

  if (!parsed.success) {
    throw new ValidationError('Invalid authentication user ID format');
  }

  return parsed.data;
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
 * Whether the caller is a platform admin. Reads only the flag off the `users`
 * row — never the full account — and caches it under the `platformAdmin` type.
 * A missing `users` row answers `false` rather than throwing: the caller is
 * authenticated but has no platform grant, which is the same answer.
 */
export const isPlatformAdmin = async ({
  authUserId,
}: {
  authUserId: string;
}): Promise<boolean> => {
  const validatedAuthUserId = parseAuthUserId(authUserId);

  const flag = await cache<PlatformAdminFlag>({
    type: 'platformAdmin',
    params: [validatedAuthUserId],
    fetch: () => selectPlatformAdminFlag(validatedAuthUserId),
  });

  return flag.isPlatformAdmin;
};

/**
 * Drop every cache layer that can serve a stale platform-admin answer: the
 * dedicated `platformAdmin` entry read by {@link isPlatformAdmin}, and the
 * `user` entry `account.getMyAccount` serves (the admin layout reads the flag
 * off that account). Must run after any write to the flag — a missed site
 * leaves a revoked admin inside `/admin` until the 72h TTL expires.
 */
export const invalidatePlatformAdminCache = async ({
  authUserId,
}: {
  authUserId: string;
}) => {
  await Promise.all([
    invalidate({ type: 'platformAdmin', params: [authUserId] }),
    invalidate({ type: 'user', params: [authUserId] }),
  ]);
};

/**
 * Grant or revoke platform admin on another user's `users` row.
 *
 * Two guards, both deliberate:
 *
 *   - an actor cannot change their own flag, so no admin can lock themselves
 *     out (and a compromised session cannot quietly self-demote to hide);
 *   - the last remaining platform admin cannot be revoked, so the grant can
 *     never be emptied out — recovering from that would take a migration.
 *
 * @returns the updated `users` row.
 */
export const setPlatformAdmin = async ({
  targetAuthUserId,
  isPlatformAdmin: nextValue,
  actorAuthUserId,
}: {
  targetAuthUserId: string;
  isPlatformAdmin: boolean;
  actorAuthUserId: string;
}) => {
  const validatedTargetId = parseAuthUserId(targetAuthUserId);
  const validatedActorId = parseAuthUserId(actorAuthUserId);

  if (validatedTargetId === validatedActorId) {
    throw new UnauthorizedError(
      'You cannot change your own platform admin access',
    );
  }

  const { isPlatformAdmin: currentValue } =
    await selectPlatformAdminFlag(validatedTargetId);

  // Only a real revocation can empty the grant out; re-revoking someone who
  // already isn't an admin is a no-op and must not trip the guard.
  if (currentValue && !nextValue) {
    const [remaining] = await db
      .select({ value: count() })
      .from(users)
      .where(
        and(
          eq(users.isPlatformAdmin, true),
          ne(users.authUserId, validatedTargetId),
        ),
      );

    if ((remaining?.value ?? 0) === 0) {
      throw new UnauthorizedError(
        'The last platform admin cannot be revoked — grant another user platform admin first',
      );
    }
  }

  const [updated] = await db
    .update(users)
    .set({ isPlatformAdmin: nextValue })
    .where(eq(users.authUserId, validatedTargetId))
    .returning();

  if (!updated) {
    throw new NotFoundError('User', validatedTargetId);
  }

  await invalidatePlatformAdminCache({ authUserId: validatedTargetId });

  logger.info(nextValue ? 'Platform admin granted' : 'Platform admin revoked', {
    targetAuthUserId: validatedTargetId,
    actorAuthUserId: validatedActorId,
    isPlatformAdmin: nextValue,
  });

  return updated;
};
