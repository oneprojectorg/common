import { AccessTierError, getNetworkMembership } from '@op/common';
import { setLogDistinctId } from '@op/logging';

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

  setLogDistinctId(user.id);

  const isMember = await getNetworkMembership(user.email);

  if (!isMember) {
    throw new AccessTierError('user');
  }

  return next({
    ctx: { ...ctx, user },
  });
};

export default withNetworkAuthenticatedUser;
