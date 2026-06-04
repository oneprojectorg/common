import { getCachedAuthUser } from '../supabase/server';
import type { MiddlewareBuilderBase, TContextWithMaybeUser } from '../types';

/**
 * Resolves the caller's Supabase identity onto `ctx.user` (including anonymous
 * sign-ins) without rejecting anyone; `ctx.user` is `undefined` when there is
 * no valid session. Performs no authorization.
 */
const withResolvedUser: MiddlewareBuilderBase<TContextWithMaybeUser> = async ({
  ctx,
  next,
}) => {
  const data = await getCachedAuthUser(ctx);

  const user = data && !data.error ? data.data.user : undefined;

  return next({
    ctx: { ...ctx, user },
  });
};

export default withResolvedUser;
