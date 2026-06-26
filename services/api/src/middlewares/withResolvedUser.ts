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

  return next({
    ctx: { ...ctx, user },
  });
};

export default withResolvedUser;
