import { AccessTierError } from '@op/common';

import type {
  MiddlewareBuilderBeforeAfter,
  TContextWithMaybeUser,
  TContextWithUser,
} from '../types';

/**
 * Requires an authenticated user (any session, including anonymous sign-ins),
 * rejecting only no-JWT callers. No network/allow-list gating — authorization
 * is left to the service layer. Must run after {@link withResolvedUser}.
 */
const withAuthenticatedUser: MiddlewareBuilderBeforeAfter<
  TContextWithMaybeUser,
  TContextWithUser
> = async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new AccessTierError('none');
  }

  return next({
    ctx: { ...ctx, user: ctx.user },
  });
};

export default withAuthenticatedUser;
