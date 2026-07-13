import { db, eq } from '@op/db/client';
import { allowList, profiles, users } from '@op/db/schema';
import { randomUUID } from 'crypto';
import { type TestContext, describe, expect, it } from 'vitest';

import { appRouter } from '..';
import {
  createTestContextWithSession,
  createTestUser,
  supabaseTestAdminClient,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';
import { wasCreatedByThisSignIn } from './login';

const createCaller = createCallerFactory(appRouter);

// Teardown is registered through the running test's own context rather than the
// global `onTestFinished` import: under `describe.concurrent` the global helper
// can't reliably resolve which concurrent test is current across `await`s.
type RegisterCleanup = TestContext['onTestFinished'];

/**
 * Signs up a confirmed user (the signup trigger creates the `public.users` row
 * and individual profile) and registers teardown for the auth user and profile.
 * Mimics the account Supabase creates during a Google OAuth code exchange
 * before the allow-list gate runs.
 */
const signUpConfirmedUser = async (
  email: string,
  onTestFinished: RegisterCleanup,
) => {
  const { user, session } = await createTestUser(email);
  if (!user || !session) {
    throw new Error(`Failed to sign up test user: ${email}`);
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
const signUpNonAllowlistedUser = (onTestFinished: RegisterCleanup) =>
  signUpConfirmedUser(
    `oauth-orphan-${randomUUID()}@example.com`,
    onTestFinished,
  );

/** A confirmed user admitted by an explicit allow-list entry (non-network domain). */
const signUpAllowlistedUser = async (onTestFinished: RegisterCleanup) => {
  const result = await signUpConfirmedUser(
    `allowlisted-${randomUUID()}@example.com`,
    onTestFinished,
  );
  await db.insert(allowList).values({ email: result.email });
  onTestFinished(async () => {
    await db.delete(allowList).where(eq(allowList.email, result.email));
  });
  return result;
};

describe.concurrent('account.login: rejected OAuth sign-in cleanup', () => {
  it('deletes the just-created account when the allow-list rejects an OAuth sign-in', async ({
    onTestFinished,
  }) => {
    const { email, user, session, profileId } =
      await signUpNonAllowlistedUser(onTestFinished);

    const caller = createCaller(await createTestContextWithSession(session));
    await expect(
      caller.account.login({ email, usingOAuth: true }),
    ).rejects.toThrow(/invite-only/);

    const { data: authAfter } =
      await supabaseTestAdminClient.auth.admin.getUserById(user.id);
    expect(authAfter?.user).toBeFalsy();

    const userRowAfter = await db.query.users.findFirst({
      where: { authUserId: user.id },
    });
    expect(userRowAfter).toBeUndefined();

    const profileAfter = await db.query.profiles.findFirst({
      where: { id: profileId },
    });
    expect(profileAfter).toBeUndefined();
  });

  it('keeps the account when a rejected login is not OAuth', async ({
    onTestFinished,
  }) => {
    const { email, user, session } =
      await signUpNonAllowlistedUser(onTestFinished);

    const caller = createCaller(await createTestContextWithSession(session));
    await expect(
      caller.account.login({ email, usingOAuth: false }),
    ).rejects.toThrow(/invite-only/);

    const { data: authAfter } =
      await supabaseTestAdminClient.auth.admin.getUserById(user.id);
    expect(authAfter?.user?.id).toBe(user.id);
  });

  it('keeps a users row that predates this sign-in (trigger ON CONFLICT repoint)', async ({
    onTestFinished,
  }) => {
    const { email, user, session, profileId } =
      await signUpNonAllowlistedUser(onTestFinished);

    // Simulate the signup trigger's ON CONFLICT (email) branch having
    // repointed a pre-existing users row at the just-created auth user.
    await db
      .update(users)
      .set({ createdAt: '2020-01-01T00:00:00.000Z' })
      .where(eq(users.authUserId, user.id));

    const caller = createCaller(await createTestContextWithSession(session));
    await expect(
      caller.account.login({ email, usingOAuth: true }),
    ).rejects.toThrow(/invite-only/);

    const { data: authAfter } =
      await supabaseTestAdminClient.auth.admin.getUserById(user.id);
    expect(authAfter?.user?.id).toBe(user.id);

    const profileAfter = await db.query.profiles.findFirst({
      where: { id: profileId },
    });
    expect(profileAfter).toBeDefined();
  });

  it('keeps the account when the session does not belong to the rejected email', async ({
    onTestFinished,
  }) => {
    const { user, session } = await signUpNonAllowlistedUser(onTestFinished);

    const caller = createCaller(await createTestContextWithSession(session));
    const otherEmail = `oauth-orphan-${randomUUID()}@example.com`;
    await expect(
      caller.account.login({ email: otherEmail, usingOAuth: true }),
    ).rejects.toThrow(/invite-only/);

    const { data: authAfter } =
      await supabaseTestAdminClient.auth.admin.getUserById(user.id);
    expect(authAfter?.user?.id).toBe(user.id);
  });
});

describe.concurrent('account.login: accepted network-member sign-in', () => {
  it('returns true and keeps the account for an allow-listed OAuth sign-in', async ({
    onTestFinished,
  }) => {
    const { email, user, session, profileId } =
      await signUpAllowlistedUser(onTestFinished);

    const caller = createCaller(await createTestContextWithSession(session));
    await expect(
      caller.account.login({ email, usingOAuth: true }),
    ).resolves.toBe(true);

    const { data: authAfter } =
      await supabaseTestAdminClient.auth.admin.getUserById(user.id);
    expect(authAfter?.user?.id).toBe(user.id);

    const userRowAfter = await db.query.users.findFirst({
      where: { authUserId: user.id },
    });
    expect(userRowAfter).toBeDefined();

    const profileAfter = await db.query.profiles.findFirst({
      where: { id: profileId },
    });
    expect(profileAfter).toBeDefined();
  });

  it('returns true for an allow-listed email (OTP) sign-in', async ({
    onTestFinished,
  }) => {
    const { email, user, session } =
      await signUpAllowlistedUser(onTestFinished);

    const caller = createCaller(await createTestContextWithSession(session));
    await expect(
      caller.account.login({ email, usingOAuth: false }),
    ).resolves.toBe(true);

    const { data: authAfter } =
      await supabaseTestAdminClient.auth.admin.getUserById(user.id);
    expect(authAfter?.user?.id).toBe(user.id);
  });

  it('returns true and keeps the account for a network-domain OAuth sign-in', async ({
    onTestFinished,
  }) => {
    const { email, user, session, profileId } = await signUpConfirmedUser(
      `network-${randomUUID()}@oneproject.org`,
      onTestFinished,
    );

    const caller = createCaller(await createTestContextWithSession(session));
    await expect(
      caller.account.login({ email, usingOAuth: true }),
    ).resolves.toBe(true);

    const { data: authAfter } =
      await supabaseTestAdminClient.auth.admin.getUserById(user.id);
    expect(authAfter?.user?.id).toBe(user.id);

    const profileAfter = await db.query.profiles.findFirst({
      where: { id: profileId },
    });
    expect(profileAfter).toBeDefined();
  });
});

describe('wasCreatedByThisSignIn', () => {
  const createdAt = '2026-01-01T12:00:00.000Z';

  it('is true when the first sign-in happens as the account is created', () => {
    expect(
      wasCreatedByThisSignIn({
        created_at: createdAt,
        last_sign_in_at: '2026-01-01T12:00:05.000Z',
      }),
    ).toBe(true);
  });

  it('is false for a pre-existing account signing in again later', () => {
    expect(
      wasCreatedByThisSignIn({
        created_at: createdAt,
        last_sign_in_at: '2026-01-02T12:00:00.000Z',
      }),
    ).toBe(false);
  });

  it('is false when the last sign-in precedes account creation', () => {
    expect(
      wasCreatedByThisSignIn({
        created_at: createdAt,
        last_sign_in_at: '2026-01-01T11:59:00.000Z',
      }),
    ).toBe(false);
  });

  it('is false when the last sign-in time is unknown', () => {
    expect(wasCreatedByThisSignIn({ created_at: createdAt })).toBe(false);
  });
});
