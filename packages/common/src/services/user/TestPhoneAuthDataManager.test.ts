import { TestPhoneAuthDataManager } from '@op/common/testing';
import { db, eq } from '@op/db/client';
import { authUsers, profiles, users } from '@op/db/schema';
import { describe, expect, it, vi } from 'vitest';

import { parsePhoneNumber, toGoTruePhoneFormat } from '../notification/schemas';

const PHONE = parsePhoneNumber('+15005550009');

const readRows = async (authUserId: string) => {
  const [authUser] = await db
    .select({ id: authUsers.id })
    .from(authUsers)
    .where(eq(authUsers.phone, toGoTruePhoneFormat(PHONE)))
    .limit(1);
  const [user] = await db
    .select({ profileId: users.profileId })
    .from(users)
    .where(eq(users.authUserId, authUserId))
    .limit(1);
  const profile = user?.profileId
    ? await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.id, user.profileId))
        .limit(1)
    : [];
  return { authUser: authUser ?? null, user: user ?? null, profile };
};

describe('TestPhoneAuthDataManager', () => {
  it('given a created phone user, when removed by phone, then the auth row, its public mirror and its profile are gone', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestPhoneAuthDataManager(task.id, onTestFinished);
    const authUserId = await testData.createUser({ phone: PHONE });
    const before = await readRows(authUserId);
    expect(before.authUser?.id).toBe(authUserId);
    expect(before.profile).toHaveLength(1);

    await testData.removeByPhone(PHONE);

    expect(await readRows(authUserId)).toEqual({
      authUser: null,
      user: null,
      profile: [],
    });
  });

  it('given the auth row is already gone, when the registered cleanup runs for its id, then it does not fail the test', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestPhoneAuthDataManager(task.id, onTestFinished);
    await testData.createUser({ phone: PHONE });

    await expect(testData.removeByPhone(PHONE)).resolves.toBeUndefined();
    await expect(testData.removeByPhone(PHONE)).resolves.toBeUndefined();
  });

  it('given GoTrue refuses the delete, when cleanup runs, then it throws instead of leaving the row behind', async ({
    task,
    onTestFinished,
  }) => {
    const owner = new TestPhoneAuthDataManager(task.id, onTestFinished);
    await owner.createUser({ phone: PHONE });

    vi.stubEnv('SUPABASE_SERVICE_ROLE', 'not-a-key');
    const unauthorized = new TestPhoneAuthDataManager(task.id, () => {});
    try {
      await expect(unauthorized.removeByPhone(PHONE)).rejects.toThrow(
        /Failed to delete phone user/,
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
