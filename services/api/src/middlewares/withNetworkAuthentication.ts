import { cache } from '@op/cache';
import { AccessTierError, getAllowListUser } from '@op/common';

import { getCachedAuthUser } from '../supabase/server';
import type { MiddlewareBuilderBase, TContextWithUser } from '../types';
import { verifyAuthentication } from '../utils/verifyAuthentication';

/**
 * Closed-network authentication gate (formerly `withAuthenticated`).
 *
 * Requires a confirmed, non-anonymous Supabase user that is either an
 * `@oneproject.org` account or present on the invite allow list. Anonymous and
 * unauthenticated callers are rejected here, before any input parsing — this is
 * the gate that enforces today's closed-network behavior.
 */
const withNetworkAuthentication: MiddlewareBuilderBase<
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

/**
 * @deprecated Use withAuthenticatedPlatformAdmin
 */
export const withAuthenticatedAdmin: MiddlewareBuilderBase<
  TContextWithUser
> = async ({ ctx, next }) => {
  const data = await getCachedAuthUser(ctx);

  const user = verifyAuthentication(data, true);

  return next({
    ctx: { ...ctx, user },
  });
};

export default withNetworkAuthentication;
