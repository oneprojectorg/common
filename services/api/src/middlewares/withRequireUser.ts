import { AccessTierError } from '@op/common';

import type {
  MiddlewareBuilderBeforeAfter,
  TContextWithMaybeUser,
  TContextWithUser,
} from '../types';

/**
 * Narrows an optionally-resolved user (see {@link withResolvedUser}) to a
 * required one: any real Supabase user — **including anonymous sign-ins** — is
 * admitted, and `ctx.user` is guaranteed defined downstream. Only fully
 * unauthenticated (no-JWT) callers are rejected here.
 *
 * Unlike {@link withNetworkAuthentication}, this gate does not enforce
 * closed-network membership, email confirmation, or the allow list. Whether an
 * authenticated caller may perform the operation is left to the service layer.
 *
 * Must run after `withResolvedUser`.
 */
const withRequireUser: MiddlewareBuilderBeforeAfter<
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

export default withRequireUser;
