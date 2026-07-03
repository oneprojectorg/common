import { db, eq } from '@op/db/client';
import { profiles } from '@op/db/schema';
import { randomUUID } from 'crypto';
import { describe, expect, it, onTestFinished } from 'vitest';

import { appRouter } from '..';
import {
  createTestContextWithSession,
  createTestUser,
  supabaseTestAdminClient,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';
import { wasCreatedByThisSignIn } from './login';

const createCaller = createCallerFactory(appRouter);

/**
 * Signs up a confirmed user whose email clears neither the allow-list nor
 * `allowedEmailDomains`, mimicking the account Supabase creates during a
 * Google OAuth code exchange before the allow-list gate runs.
 */
const signUpNonAllowlistedUser = async () => {
  const email = `oauth-orphan-${randomUUID()}@example.com`;
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

describe.concurrent('account.login: rejected OAuth sign-in cleanup', () => {
  it('deletes the just-created account when the allow-list rejects an OAuth sign-in', async () => {
    const { email, user, session, profileId } =
      await signUpNonAllowlistedUser();

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

  it('keeps the account when a rejected login is not OAuth', async () => {
    const { email, user, session } = await signUpNonAllowlistedUser();

    const caller = createCaller(await createTestContextWithSession(session));
    await expect(
      caller.account.login({ email, usingOAuth: false }),
    ).rejects.toThrow(/invite-only/);

    const { data: authAfter } =
      await supabaseTestAdminClient.auth.admin.getUserById(user.id);
    expect(authAfter?.user?.id).toBe(user.id);
  });

  it('keeps the account when the session does not belong to the rejected email', async () => {
    const { user, session } = await signUpNonAllowlistedUser();

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
