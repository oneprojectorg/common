import { getCachedAuthClaims } from '../supabase/server';
import type {
  MiddlewareBuilderBase,
  TContextWithMaybeClaimsUser,
} from '../types';
import { userFromClaims } from '../utils/userFromClaims';

/**
 * Resolves the caller's Supabase identity onto `ctx.user` (including anonymous
 * sign-ins) without rejecting anyone; `ctx.user` is `undefined` when there is
 * no valid session. Performs no authorization.
 *
 * Identity is established by verifying the caller's JWT locally against the
 * project JWKS — no GoTrue HTTPS round-trip on the common path. `ctx.user`
 * therefore has the narrower {@link ClaimsUser} shape — server-side
 * timestamps such as `confirmed_at` and `last_sign_in_at` are not present.
 * Stricter middlewares ({@link withConfirmedUser},
 * {@link withNetworkAuthenticatedUser}, {@link withAuthenticatedPlatformAdmin})
 * still call the authoritative `getCachedAuthUser` and surface a full
 * Supabase `User` because they read those fields.
 */
const withResolvedUser: MiddlewareBuilderBase<
  TContextWithMaybeClaimsUser
> = async ({ ctx, next }) => {
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
