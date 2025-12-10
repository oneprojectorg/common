import { UnauthorizedError, isUserEmailPlatformAdmin } from '@op/common';

import { createSBAdminClient } from '../supabase/server';
import type { MiddlewareBuilderBase, TContextWithUser } from '../types';
import { verifyAuthentication } from '../utils/verifyAuthentication';

/**
 * Middleware to ensure the user is authenticated and is a platform admin
 */
export const withAuthenticatedPlatformAdmin: MiddlewareBuilderBase<
  TContextWithUser
> = async ({ ctx, next }) => {
  const supabase = createSBAdminClient(ctx);
  const data = await supabase.auth.getUser();

  const user = verifyAuthentication(data);

  const userEmail = user.email;

  if (!userEmail) {
    throw new UnauthorizedError('User email is required for authentication');
  }

  const isAdmin = isUserEmailPlatformAdmin(userEmail);

  if (!isAdmin) {
    throw new UnauthorizedError('Platform admin access required');
  }

  return next({
    ctx: { ...ctx, user },
  });
};
