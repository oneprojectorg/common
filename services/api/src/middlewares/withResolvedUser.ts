import { setLogDistinctId } from '@op/logging';

import { getCachedAuthClaims } from '../supabase/server';
import type { MiddlewareBuilderBase, TContextWithMaybeUser } from '../types';
import { userFromClaims } from '../utils/userFromClaims';

/**
 * Resolves the caller's identity onto `ctx.user` (including anonymous
 * sign-ins) via local JWKS verification — no GoTrue round-trip. `ctx.user` is
 * `undefined` when there is no valid session; authorization happens further
 * down the chain.
 */
const withResolvedUser: MiddlewareBuilderBase<TContextWithMaybeUser> = async ({
  ctx,
  next,
}) => {
  const result = await getCachedAuthClaims(ctx);

  const user =
    result.data && !result.error
      ? userFromClaims(result.data.claims)
      : undefined;

  if (user) {
    // user.id is the auth user id the frontend passes to posthog.identify(),
    // so PostHog can link this request's logs to the person
    setLogDistinctId(user.id);
  }

  return next({
    ctx: { ...ctx, user },
  });
};

export default withResolvedUser;
