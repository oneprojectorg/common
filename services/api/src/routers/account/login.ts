import { cache } from '@op/cache';
import { CommonError, ValidationError, getAllowListUser } from '@op/common';
import { adminEmails, allowedEmailDomains, genericEmail } from '@op/core';
import { db, eq } from '@op/db/client';
import { profiles } from '@op/db/schema';
import { z } from 'zod';

import withRateLimited from '../../middlewares/withRateLimited';
import { createSBAdminClient, getCachedAuthUser } from '../../supabase/server';
import { commonProcedure, router } from '../../trpcFactory';
import type { TContext, TContextWithLogger } from '../../types';

/**
 * Being turned away by the invite gate is an expected product outcome, not a
 * failure, so it comes back as a tagged union rather than a thrown error: a
 * throw would land in the `error` log stream alongside real 500s, and would
 * carry the user-facing copy as an English exception message that the app —
 * the only layer with translations — could only string-match. `reason` is
 * machine-readable; the caller maps it to localized copy.
 */
const loginResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), reason: z.literal('waitlisted') }),
]);

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
    .output(loginResultSchema)
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

      // An existing account may always log back in: the OTP/OAuth exchange
      // proves email ownership, and network access is gated separately by
      // `isNetworkMember`. Claim-flow accounts (`useClaimAccount`) have no
      // allow-list entry, so the allow-list only decides (below) whether an
      // email without an account may create one. auth.users is the canonical
      // record; anonymous accounts have a NULL email there.
      const existingAuthUser = await db.query.authUsers.findFirst({
        columns: { id: true },
        where: { email: input.email },
      });

      let ownsExistingAccount = Boolean(existingAuthUser);

      if (ownsExistingAccount && input.usingOAuth) {
        // The OAuth code exchange creates the account before this gate runs,
        // so discount one created by the very sign-in being gated.
        const {
          data: { user: authUser },
        } = await getCachedAuthUser(ctx);

        if (
          authUser?.email?.toLowerCase() === input.email &&
          wasCreatedByThisSignIn(authUser)
        ) {
          ownsExistingAccount = false;
        }
      }

      if (!ownsExistingAccount) {
        const allowedUserEmail = await cache<
          ReturnType<typeof getAllowListUser>
        >({
          type: 'allowList',
          params: [input.email],
          fetch: () => getAllowListUser({ email: input.email }),
        });

        // No account and not invited: add them to the waitlist.
        if (
          !allowedUserEmail?.email &&
          !allowedEmailDomains.includes(emailDomain) &&
          !adminEmails.includes(input.email)
        ) {
          if (input.usingOAuth) {
            // The OAuth code exchange already created the account (auth.users
            // plus the trigger-created public.users row and individual profile)
            // before this gate ran, so remove it or the rejected visitor
            // persists as an orphaned user.
            await deleteRejectedOAuthSignup({ ctx, email: input.email });
          }

          // The outcome, at `info`: this is an expected product decision, not a
          // failure. The `Login attempt` line above shares this requestId and
          // already carries the address, so the email is not repeated here.
          logger.info('Login waitlisted - not invited', { emailDomain });

          return { ok: false, reason: 'waitlisted' };
        }
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

      return { ok: true };
    }),
});

const FIRST_SIGN_IN_WINDOW_MS = 60_000;

/**
 * Whether this sign-in is the one that created the account. Both timestamps
 * come from GoTrue, so the check is immune to app-server clock skew. A
 * pre-existing account (e.g. one whose allow-list entry was later revoked)
 * has a much older `created_at` and must never be deleted.
 */
export const wasCreatedByThisSignIn = (user: {
  created_at: string;
  last_sign_in_at?: string;
}): boolean => {
  if (!user.last_sign_in_at) {
    return false;
  }

  const msFromCreationToSignIn =
    new Date(user.last_sign_in_at).getTime() -
    new Date(user.created_at).getTime();

  return (
    msFromCreationToSignIn >= 0 &&
    msFromCreationToSignIn < FIRST_SIGN_IN_WINDOW_MS
  );
};

const deleteRejectedOAuthSignup = async ({
  ctx,
  email,
}: {
  ctx: TContext & TContextWithLogger;
  email: string;
}): Promise<void> => {
  // Cleanup is best-effort: a failure here must not change the login
  // response, the caller still returns the waitlisted result.
  try {
    const {
      data: { user: authUser },
    } = await getCachedAuthUser(ctx);

    if (
      !authUser?.email ||
      authUser.email.toLowerCase() !== email ||
      !wasCreatedByThisSignIn(authUser)
    ) {
      ctx.logger.warn('Skipped cleanup of rejected OAuth sign-in', { email });
      return;
    }

    const orphanedUser = await db.query.users.findFirst({
      where: { authUserId: authUser.id },
    });

    // The signup trigger's ON CONFLICT (email) branch can repoint a
    // pre-existing users row (and its established profile) at the
    // just-created auth user. The trigger copies created_at from the auth
    // user on insert, so only a row whose created_at matches this signup is
    // safe to delete. The comparison is written to fail closed: an
    // unparseable timestamp yields NaN, which never satisfies `<`.
    const usersRowAgeMs = Math.abs(
      new Date(orphanedUser?.createdAt ?? NaN).getTime() -
        new Date(authUser.created_at).getTime(),
    );
    if (!(usersRowAgeMs < FIRST_SIGN_IN_WINDOW_MS)) {
      ctx.logger.warn('Skipped cleanup of rejected OAuth sign-in', {
        email,
        authUserId: authUser.id,
      });
      return;
    }

    const supabase = createSBAdminClient(ctx);
    // Cascades to the public.users row created by the signup trigger. The
    // auth user goes first: if the profile deletion below fails, the
    // leftover is a dead profile row nobody owns, whereas the reverse order
    // would strand a real account without a profile (the trigger only fires
    // on auth.users INSERT, so it would never be recreated).
    const { error } = await supabase.auth.admin.deleteUser(authUser.id);
    if (error) {
      ctx.logger.error('Failed to delete auth user of rejected OAuth sign-in', {
        email,
        authUserId: authUser.id,
        error,
      });
      return;
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
