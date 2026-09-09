import {
  AccessTierError,
  UnauthorizedError,
  isPlatformAdmin,
} from '@op/common';

import { getCachedAuthUser } from '../supabase/server';
import type { MiddlewareBuilderBase, TContextWithUser } from '../types';
import { verifyAuthentication } from '../utils/verifyAuthentication';

/** Ensures the caller is authenticated and holds the platform admin grant. */
export const withAuthenticatedPlatformAdmin: MiddlewareBuilderBase<
  TContextWithUser
> = async ({ ctx, next }) => {
  const data = await getCachedAuthUser(ctx);

  const user = verifyAuthentication(data);

  if (!user.id) {
    throw new AccessTierError('anon');
  }

  const isAdmin = await isPlatformAdmin({ authUserId: user.id });

  // Authenticated (past the gate), but not permitted to use this endpoint.
  if (!isAdmin) {
    throw new UnauthorizedError('Platform admin access required');
  }

  return next({
    ctx: { ...ctx, user },
  });
};
