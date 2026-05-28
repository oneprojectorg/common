import { UnauthorizedError } from '@op/common';

import type {
  MiddlewareBuilderBeforeAfter,
  TContextWithMaybeUser,
  TContextWithUser,
} from '../types';

/**
 * Narrows `ctx.user` from `User | undefined` to `User`. Throws
 * `UnauthorizedError` for no-JWT callers. Stack on top of
 * `withResolveUser` to admit anon-JWT callers while rejecting fully
 * unauthenticated ones.
 */
const withRequireUser: MiddlewareBuilderBeforeAfter<
  TContextWithMaybeUser,
  TContextWithUser
> = async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new UnauthorizedError('Authenticated session required');
  }

  return next({
    ctx: { ...ctx, user: ctx.user },
  });
};

export default withRequireUser;
