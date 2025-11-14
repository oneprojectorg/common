import { cache } from '@op/cache';
import { getAllowListUser, isUserPlatformAdmin } from '@op/common';
import { adminEmails } from '@op/core';
import type { UserResponse } from '@op/supabase/lib';
import { TRPCError } from '@trpc/server';

import { createSBAdminClient } from '../supabase/server';
import type { MiddlewareBuilderBase, TContextWithUser } from '../types';

const verifyAuthentication = (data: UserResponse, adminOnly = false) => {
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
  const data = await supabase.auth.getUser(ctx.jwt);

  const user = verifyAuthentication(data);

  // if the user is not a oneproject.org user, verify against the allow list
  if (user.email?.toLowerCase().split('@')[1] !== 'oneproject.org') {
    // Only allow users who are invited
    const allowedUserEmail = await cache<ReturnType<typeof getAllowListUser>>({
      type: 'allowList',
      params: [user.email?.toLowerCase()],
      fetch: () => getAllowListUser({ email: user.email?.toLowerCase() }),
      options: {
        ttl: 30 * 60 * 1000,
      },
    });

    if (!allowedUserEmail) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
      });
    }
  }

  return next({
    ctx: { ...ctx, user },
  });
};

/**
 * @deprecated Use withAuthenticatedPlatformAdmin
 */
export const withAuthenticatedAdmin: MiddlewareBuilderBase<
  TContextWithUser
> = async ({ ctx, next }) => {
  const supabase = createSBAdminClient(ctx);
  const data = await supabase.auth.getUser();

  const user = verifyAuthentication(data, true);

  return next({
    ctx: { ...ctx, user },
  });
};

/**
 * Middleware to ensure the user is authenticated and is a platform admin
 */
export const withAuthenticatedPlatformAdmin: MiddlewareBuilderBase<
  TContextWithUser
> = async ({ ctx, next }) => {
  const supabase = createSBAdminClient(ctx);
  // Pass ctx.jwt for testing purposes only (see types.ts)
  const data = await supabase.auth.getUser(ctx.jwt);

  const user = verifyAuthentication(data);
  const isAdmin = isUserPlatformAdmin(user);

  if (!isAdmin) {
    throw new TRPCError({
      message: 'Platform admin access required',
      code: 'UNAUTHORIZED',
    });
  }

  return next({
    ctx: { ...ctx, user },
  });
};

export default withAuthenticated;
