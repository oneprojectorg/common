import {
  AccessTierError,
  UnauthorizedError,
  isUserEmailPlatformAdmin,
} from '@op/common';

import { getCachedAuthUser } from '../supabase/server';
import type { MiddlewareBuilderBase, TContextWithUser } from '../types';
import { verifyAuthentication } from '../utils/verifyAuthentication';

/**
 * Middleware to ensure the user is authenticated and is a platform admin
 */
export const withAuthenticatedPlatformAdmin: MiddlewareBuilderBase<
  TContextWithUser
> = async ({ ctx, next }) => {
  const data = await getCachedAuthUser(ctx);

  // Admin endpoints require at least the `user` tier; admin membership itself
  // is a role check (authorization), handled below.
  const user = verifyAuthentication(data);

  const userEmail = user.email;

  if (!userEmail) {
    // A confirmed account with no email isn't a usable `user`-tier identity.
    throw new AccessTierError('anon');
  }

  const isAdmin = isUserEmailPlatformAdmin(userEmail);

  // Admin membership is authorization: the caller is authenticated (past the
  // gate) but is not permitted to use this admin endpoint.
  if (!isAdmin) {
    throw new UnauthorizedError('Platform admin access required');
  }

  return next({
    ctx: { ...ctx, user },
  });
};
