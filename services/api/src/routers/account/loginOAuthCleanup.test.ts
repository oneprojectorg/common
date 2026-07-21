import { db, eq } from '@op/db/client';
import { authUsers, profiles, users } from '@op/db/schema';
import { randomUUID } from 'crypto';
import { describe, expect, it } from 'vitest';

import { appRouter } from '..';
import {
  signUpAllowlistedUser,
  signUpConfirmedUser,
  signUpNonAllowlistedUser,
} from '../../test/helpers/loginTestUtils';
import {
  TEST_USER_DEFAULT_PASSWORD,
  createTestContextWithSession,
  supabaseTestAdminClient,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';
import { wasCreatedByThisSignIn } from './login';

const createCaller = createCallerFactory(appRouter);

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

// The anon claim flow (`useClaimAccount`) attaches an email onto an anonymous
// user through GoTrue directly, so its accounts own an `auth.users` row with
// the email set (anonymous rows keep email NULL) but have no allow-list
// entry. `signUpConfirmedUser` yields that exact DB state, so these tests
// stand in for a claimed account logging back in after its session ended.
describe.concurrent('account.login: existing claimed accounts', () => {
  it('lets a confirmed out-of-network account owner log back in via OTP', async ({
    onTestFinished,
  }) => {
    const { email, user } = await signUpNonAllowlistedUser(onTestFinished);

    // No session: the owner comes back on a fresh device/browser.
    const caller = createCaller(await createTestContextWithSession(null));
    await expect(
      caller.account.login({ email, usingOAuth: false }),
    ).resolves.toBe(true);

    const { data: authAfter } =
      await supabaseTestAdminClient.auth.admin.getUserById(user.id);
    expect(authAfter?.user?.id).toBe(user.id);
  });

  it('lets a pre-existing out-of-network account through the OAuth gate without deleting it', async ({
    onTestFinished,
  }) => {
    const { email, user, session, profileId } =
      await signUpNonAllowlistedUser(onTestFinished);

    // Age the account so `wasCreatedByThisSignIn` no longer treats it as a
    // signup made by the OAuth exchange currently being gated.
    await db
      .update(authUsers)
      .set({ createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) })
      .where(eq(authUsers.id, user.id));

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

  it('lets an unconfirmed account proceed to the OTP', async ({
    onTestFinished,
  }) => {
    // The gate only asks whether the email is attached to an account, not
    // whether it was confirmed — the OTP itself is what proves email
    // ownership before a session is issued.
    const email = `unconfirmed-${randomUUID()}@example.com`;
    const { data, error } = await supabaseTestAdminClient.auth.admin.createUser(
      {
        email,
        password: TEST_USER_DEFAULT_PASSWORD,
        email_confirm: false,
      },
    );
    const user = data.user;
    if (error || !user) {
      throw new Error(
        `Failed to create unconfirmed test user ${email}: ${error?.message}`,
      );
    }
    onTestFinished(async () => {
      const userRow = await db.query.users.findFirst({
        where: { authUserId: user.id },
      });
      await supabaseTestAdminClient.auth.admin
        .deleteUser(user.id)
        .catch(() => {});
      if (userRow?.profileId) {
        await db.delete(profiles).where(eq(profiles.id, userRow.profileId));
      }
    });

    const caller = createCaller(await createTestContextWithSession(null));
    await expect(
      caller.account.login({ email, usingOAuth: false }),
    ).resolves.toBe(true);
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
