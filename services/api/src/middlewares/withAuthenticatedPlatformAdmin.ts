import {
  AccessTierError,
  UnauthorizedError,
  isPlatformAdmin,
} from '@op/common';

import { getCachedAuthUser } from '../supabase/server';
import type { MiddlewareBuilderBase, TContextWithUser } from '../types';
import { verifyAuthentication } from '../utils/verifyAuthentication';

/**
 * Middleware to ensure the user is authenticated and is a platform admin.
 *
 * `isPlatformAdmin` is the read-through variant on purpose: the flag is only
 * ever changed by an operator's SQL, so a cache entry here could keep admitting
 * a revoked admin with nothing able to clear it. Use `isPlatformAdminCached`
 * only for presentational reads.
 */
export const withAuthenticatedPlatformAdmin: MiddlewareBuilderBase<
  TContextWithUser
> = async ({ ctx, next }) => {
  const data = await getCachedAuthUser(ctx);

  const user = verifyAuthentication(data);

  // An auth identity with no id can't carry a platform grant — the flag lives
  // on the `users` row keyed by it.
  if (!user.id) {
    throw new AccessTierError('anon');
  }

  const isAdmin = await isPlatformAdmin({ authUserId: user.id });

  // Admin membership is authorization: the caller is authenticated (past the
  // gate) but is not permitted to use this admin endpoint.
  if (!isAdmin) {
    throw new UnauthorizedError('Platform admin access required');
  }

  return next({
    ctx: { ...ctx, user },
  });
};
