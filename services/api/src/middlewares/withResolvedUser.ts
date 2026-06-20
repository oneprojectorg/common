import { getCachedAuthClaims } from '../supabase/server';
import type { MiddlewareBuilderBase, TContextWithMaybeUser } from '../types';
import { userFromClaims } from '../utils/userFromClaims';

/**
 * Resolves the caller's Supabase identity onto `ctx.user` (including anonymous
 * sign-ins) without rejecting anyone; `ctx.user` is `undefined` when there is
 * no valid session. Performs no authorization.
 *
 * Identity is established by verifying the caller's JWT locally against the
 * project JWKS — no GoTrue HTTPS round-trip on the common path. Stricter
 * middlewares ({@link withConfirmedUser}, {@link withNetworkAuthenticatedUser},
 * {@link withAuthenticatedPlatformAdmin}) still call the authoritative
 * `getCachedAuthUser` because they need server-side fields (`confirmed_at`,
 * `last_sign_in_at`) that the JWT does not carry.
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
