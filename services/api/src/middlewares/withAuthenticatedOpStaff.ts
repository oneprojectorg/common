import {
  AccessTierError,
  UnauthorizedError,
  isUserEmailOpStaff,
} from '@op/common';

import { getCachedAuthUser } from '../supabase/server';
import type { MiddlewareBuilderBase, TContextWithUser } from '../types';
import { verifyAuthentication } from '../utils/verifyAuthentication';

/**
 * Middleware to ensure the user is authenticated and works at OP
 */
export const withAuthenticatedOpStaff: MiddlewareBuilderBase<
  TContextWithUser
> = async ({ ctx, next }) => {
  const data = await getCachedAuthUser(ctx);

  const user = verifyAuthentication(data);

  if (!user.email) {
    throw new AccessTierError('anon');
  }

  // The gate trusts the email domain, so the email itself must be confirmed;
  // a confirmed phone alone does not prove it.
  if (!user.email_confirmed_at || !isUserEmailOpStaff(user.email)) {
    throw new UnauthorizedError('OP staff access required');
  }

  return next({
    ctx: { ...ctx, user },
  });
};
