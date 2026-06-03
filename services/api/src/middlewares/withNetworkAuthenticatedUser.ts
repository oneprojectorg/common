import { cache } from '@op/cache';
import { AccessTierError, getAllowListUser } from '@op/common';

import { getCachedAuthUser } from '../supabase/server';
import type { MiddlewareBuilderBase, TContextWithUser } from '../types';
import { verifyAuthentication } from '../utils/verifyAuthentication';

/**
 * Closed-network authentication gate. Requires a confirmed, non-anonymous user
 * that is either an `@oneproject.org` account or on the invite allow list;
 * everyone else is rejected before input parsing. This is the strongest user
 * gate — a network-authenticated user is also an authenticated user (see
 * {@link withAuthenticatedUser}).
 */
const withNetworkAuthenticatedUser: MiddlewareBuilderBase<
  TContextWithUser
> = async ({ ctx, next }) => {
  const data = await getCachedAuthUser(ctx);

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
      throw new AccessTierError('user');
    }
  }

  return next({
    ctx: { ...ctx, user },
  });
};

export default withNetworkAuthenticatedUser;
