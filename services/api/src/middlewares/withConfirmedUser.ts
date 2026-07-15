import { setLogDistinctId } from '@op/logging';

import { getCachedAuthUser } from '../supabase/server';
import type { MiddlewareBuilderBase, TContextWithUser } from '../types';
import { verifyAuthentication } from '../utils/verifyAuthentication';

/**
 * Confirmed-user authentication gate. Requires a confirmed, non-anonymous user
 * — a real account whose email/phone has been confirmed (`confirmed_at` is set)
 * — but applies no closed-network/allow-list gating; authorization is left to
 * the service layer. Sits one tier below {@link withNetworkAuthenticatedUser},
 * which additionally enforces the `@oneproject.org` / invite allow list.
 *
 * Note: a real but as-yet-unconfirmed signup (`confirmed_at === null`) is
 * rejected here as `anon`, alongside anonymous sessions — see
 * {@link verifyAuthentication}.
 */
const withConfirmedUser: MiddlewareBuilderBase<TContextWithUser> = async ({
  ctx,
  next,
}) => {
  const data = await getCachedAuthUser(ctx);

  const user = verifyAuthentication(data);

  setLogDistinctId(user.id);

  return next({
    ctx: { ...ctx, user },
  });
};

export default withConfirmedUser;
