import { AccessTierError } from '@op/common';

import type {
  MiddlewareBuilderBeforeAfter,
  TContextWithClaimsUser,
  TContextWithMaybeUser,
} from '../types';

/**
 * Requires an authenticated user (any session, including anonymous sign-ins),
 * rejecting only no-JWT callers. No network/allow-list gating — authorization
 * is left to the service layer. Must run after {@link withResolvedUser}; the
 * resulting `ctx.user` is a {@link ClaimsUser}, not a full Supabase `User`.
 */
const withAuthenticatedUser: MiddlewareBuilderBeforeAfter<
  TContextWithMaybeUser,
  TContextWithClaimsUser
> = async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new AccessTierError('none');
  }

  return next({
    ctx: { ...ctx, user: ctx.user },
  });
};

export default withAuthenticatedUser;
