import { cache } from '@op/cache';
import {
  CommonError,
  UnauthorizedError,
  ValidationError,
  getAllowListUser,
} from '@op/common';
import {
  APP_NAME,
  adminEmails,
  allowedEmailDomains,
  genericEmail,
} from '@op/core';
import { db, eq } from '@op/db/client';
import { profiles } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { z } from 'zod';

import withRateLimited from '../../middlewares/withRateLimited';
import { createSBAdminClient, getCachedAuthUser } from '../../supabase/server';
import { commonProcedure, router } from '../../trpcFactory';
import type { TContext, TContextWithLogger } from '../../types';

const login = router({
  login: commonProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 3 }))
    // Router
    .input(
      z.object({
        email: z.email().toLowerCase().trim(),
        usingOAuth: z.boolean().optional(),
      }),
    )
    .output(z.boolean())
    .query(async ({ input, ctx }) => {
      const { logger } = ctx;
      const emailDomain = input.email.split('@')[1];

      logger.info('Login attempt', {
        email: input.email,
        emailDomain,
        usingOAuth: input.usingOAuth,
      });

      if (!emailDomain) {
        logger.warn('Login failed - invalid email', { email: input.email });
        throw new ValidationError('Invalid email');
      }

      const allowedUserEmail = await cache<ReturnType<typeof getAllowListUser>>(
        {
          type: 'allowList',
          params: [input.email],
          fetch: () => getAllowListUser({ email: input.email }),
        },
      );

      // If the user is not invited, add them to the waitlist
      if (
        !allowedUserEmail?.email &&
        !allowedEmailDomains.includes(emailDomain) &&
        !adminEmails.includes(input.email)
      ) {
        if (input.usingOAuth) {
          // The OAuth code exchange already created the account (auth.users
          // plus the trigger-created public.users row and individual profile)
          // before this gate ran, so remove it again or the rejected visitor
          // persists as an orphaned user.
          await deleteRejectedOAuthSignup({ ctx, email: input.email });
        }

        throw new UnauthorizedError(
          `${APP_NAME} is invite-only! You’re now on the waitlist. Keep an eye on your inbox for updates.`,
        );
      }

      // If the user is not using OAuth and doesn't have a token, send them an OTP
      if (!input.usingOAuth) {
        const supabase = createSBAdminClient(ctx);

        const authResponse = await supabase.auth.signInWithOtp({
          email: input.email,
          options: {
            shouldCreateUser: true,
          },
        });

        if (authResponse.error) {
          logger.error('Login error', {
            error: authResponse.error,
            email: input.email,
          });
          throw new CommonError(
            `There was an error signing you in. We are currently investigating the issue. Please try again in a few minutes. If you need further assistance, don't hesitate to contact us at ${genericEmail}`,
          );
        }
      }

      return true;
    }),
});

const FIRST_SIGN_IN_WINDOW_MS = 60_000;

/**
 * Whether this sign-in is the one that created the account. Both timestamps
 * come from GoTrue, so the check is immune to app-server clock skew. A
 * pre-existing account (e.g. one whose allow-list entry was later revoked)
 * has a much older `created_at` and must never be deleted.
 */
export const wasCreatedByThisSignIn = (
  user: Pick<User, 'created_at' | 'last_sign_in_at'>,
): boolean => {
  if (!user.last_sign_in_at) {
    return false;
  }

  const createdAt = new Date(user.created_at).getTime();
  const lastSignInAt = new Date(user.last_sign_in_at).getTime();

  return Math.abs(lastSignInAt - createdAt) < FIRST_SIGN_IN_WINDOW_MS;
};

const deleteRejectedOAuthSignup = async ({
  ctx,
  email,
}: {
  ctx: TContext & TContextWithLogger;
  email: string;
}): Promise<void> => {
  // Cleanup is best-effort: a failure here must not change the login
  // response, the caller still throws UnauthorizedError.
  try {
    const {
      data: { user: authUser },
    } = await getCachedAuthUser(ctx);

    if (
      !authUser?.email ||
      authUser.email.toLowerCase() !== email ||
      !wasCreatedByThisSignIn(authUser)
    ) {
      return;
    }

    const orphanedUser = await db.query.users.findFirst({
      where: { authUserId: authUser.id },
    });

    const supabase = createSBAdminClient(ctx);
    // Cascades to the public.users row created by the signup trigger.
    const { error } = await supabase.auth.admin.deleteUser(authUser.id);
    if (error) {
      throw error;
    }

    if (orphanedUser?.profileId) {
      await db.delete(profiles).where(eq(profiles.id, orphanedUser.profileId));
    }

    ctx.logger.info('Deleted account created by rejected OAuth sign-in', {
      email,
      authUserId: authUser.id,
    });
  } catch (error) {
    ctx.logger.error('Failed to clean up rejected OAuth sign-in', {
      email,
      error,
    });
  }
};

export default login;
