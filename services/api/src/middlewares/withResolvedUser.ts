import { getCachedAuthUser } from '../supabase/server';
import type { MiddlewareBuilderBase, TContextWithMaybeUser } from '../types';

/**
 * Resolves the caller's Supabase identity onto `ctx.user` without rejecting
 * anyone. If the request carries a valid session — including an anonymous
 * sign-in — `ctx.user` is the resolved user; otherwise it is `undefined`.
 *
 * This middleware performs **no authorization**: it neither rejects anonymous
 * users nor enforces the closed-network allow list. Procedures built on it
 * (`openProcedure`, and `authenticatedProcedure` together with
 * `withRequireUser`) leave admission decisions to the service layer.
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
