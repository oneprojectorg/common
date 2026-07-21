import { db, eq } from '@op/db/client';
import { allowList, profiles } from '@op/db/schema';
import { randomUUID } from 'crypto';
import type { TestContext } from 'vitest';

import {
  TEST_USER_DEFAULT_PASSWORD,
  createIsolatedTestClient,
  supabaseTestAdminClient,
} from '../supabase-utils';

// Teardown is registered through the running test's own context rather than the
// global `onTestFinished` import: under `describe.concurrent` the global helper
// can't reliably resolve which concurrent test is current across `await`s.
export type RegisterCleanup = TestContext['onTestFinished'];

/**
 * Signs up a confirmed user (the signup trigger creates the `public.users` row
 * and individual profile) and registers teardown for the auth user and profile.
 * Mimics the account Supabase creates during a Google OAuth code exchange
 * before the allow-list gate runs. Each user is created on its own isolated
 * client so concurrent tests never share auth session state.
 */
export const signUpConfirmedUser = async (
  email: string,
  onTestFinished: RegisterCleanup,
) => {
  const { data, error } = await createIsolatedTestClient().auth.signUp({
    email,
    password: TEST_USER_DEFAULT_PASSWORD,
  });
  const user = data.user;
  const session = data.session;
  if (error || !user || !session) {
    throw new Error(
      `Failed to sign up test user ${email}: ${error?.message ?? 'no session'}`,
    );
  }

  const userRow = await db.query.users.findFirst({
    where: { authUserId: user.id },
  });
  if (!userRow?.profileId) {
    throw new Error(`Signup trigger did not create a profile for ${email}`);
  }
  const profileId = userRow.profileId;

  onTestFinished(async () => {
    await db.delete(profiles).where(eq(profiles.id, profileId));
    await supabaseTestAdminClient.auth.admin
      .deleteUser(user.id)
      .catch(() => {});
  });

  return { email, user, session, profileId };
};

/** A confirmed user whose email clears neither the allow-list nor a network domain. */
export const signUpNonAllowlistedUser = (onTestFinished: RegisterCleanup) =>
  signUpConfirmedUser(
    `oauth-orphan-${randomUUID()}@example.com`,
    onTestFinished,
  );

/** Inserts an allow-list entry for the email and registers its teardown. */
export const inviteEmail = async (
  email: string,
  onTestFinished: RegisterCleanup,
) => {
  await db.insert(allowList).values({ email });
  onTestFinished(async () => {
    await db.delete(allowList).where(eq(allowList.email, email));
  });
};

/** A confirmed user admitted by an explicit allow-list entry (non-network domain). */
export const signUpAllowlistedUser = async (
  onTestFinished: RegisterCleanup,
) => {
  const result = await signUpConfirmedUser(
    `allowlisted-${randomUUID()}@example.com`,
    onTestFinished,
  );
  await inviteEmail(result.email, onTestFinished);
  return result;
};
