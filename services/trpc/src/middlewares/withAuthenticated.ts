import { adminEmails } from '@op/core';
import type { UserResponse } from '@op/supabase/lib';
import { TRPCError } from '@trpc/server';

import { createSBAdminClient } from '../supabase/server';
import type { MiddlewareBuilderBase, TContextWithUser } from '../types';

const verifyAuthData = (data: UserResponse, adminOnly = false) => {
  if (!data) {
    throw new TRPCError({
      message: `Failed to authenticate user`,
      code: 'UNAUTHORIZED',
    });
  }

  if (data.error) {
    throw new TRPCError({
      message: `Failed to authenticate user: ${data.error.message}`,
      cause: data.error.cause,
      code: 'UNAUTHORIZED',
    });
  }

  if (data.data.user.is_anonymous) {
    throw new TRPCError({
      message: `Anonymous users are not allowed to access this resource`,
      code: 'UNAUTHORIZED',
    });
  }

  if (data.data.user.confirmed_at === null) {
    throw new TRPCError({
      message: `User has not confirmed their email address`,
      code: 'UNAUTHORIZED',
    });
  }

  if (adminOnly && !adminEmails.includes(data.data.user.email || '')) {
    throw new TRPCError({
      message: `User is not an admin`,
      code: 'UNAUTHORIZED',
    });
  }

  return data.data.user;
};

const withAuthenticated: MiddlewareBuilderBase<TContextWithUser> = async ({
  ctx,
  next,
}) => {
  const supabase = createSBAdminClient(ctx);
  const data = await supabase.auth.getUser();

  const user = verifyAuthData(data);

  return next({
    ctx: { ...ctx, user },
  });
};

export const withAuthenticatedAdmin: MiddlewareBuilderBase<
  TContextWithUser
> = async ({ ctx, next }) => {
  const supabase = createSBAdminClient(ctx);
  const data = await supabase.auth.getUser();

  const user = verifyAuthData(data, true);

  return next({
    ctx: { ...ctx, user },
  });
};

export default withAuthenticated;
