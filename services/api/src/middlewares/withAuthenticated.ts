import { cache } from '@op/cache';
import { getAllowListUser } from '@op/common';
import { TRPCError } from '@trpc/server';

import { createSBAdminClient } from '../supabase/server';
import type { MiddlewareBuilderBase, TContextWithUser } from '../types';
import { verifyAuthentication } from '../utils/verifyAuthentication';

const withAuthenticated: MiddlewareBuilderBase<TContextWithUser> = async ({
  ctx,
  next,
}) => {
  const supabase = createSBAdminClient(ctx);
  const data = await supabase.auth.getUser();

  const user = verifyAuthentication(data);

  // if the user is not a oneproject.org user, verify against the allow list
  if (user.email?.toLowerCase().split('@')[1] !== 'oneproject.org') {
    // Only allow users who are invited
    const allowedUserEmail = await cache<ReturnType<typeof getAllowListUser>>({
      type: 'allowList',
      params: [user.email?.toLowerCase()],
      fetch: () => getAllowListUser({ email: user.email?.toLowerCase() }),
      options: {
        ttl: 30 * 60 * 1000,
      },
    });

    if (!allowedUserEmail) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
      });
    }
  }

  return next({
    ctx: { ...ctx, user },
  });
};

/**
 * @deprecated Use withAuthenticatedPlatformAdmin
 */
export const withAuthenticatedAdmin: MiddlewareBuilderBase<
  TContextWithUser
> = async ({ ctx, next }) => {
  const supabase = createSBAdminClient(ctx);
  const data = await supabase.auth.getUser();

  const user = verifyAuthentication(data, true);

  return next({
    ctx: { ...ctx, user },
  });
};

export default withAuthenticated;
