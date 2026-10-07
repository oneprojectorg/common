import { TestPhoneAuthDataManager } from '@op/common/testing';
import { db, eq } from '@op/db/client';
import { authUsers, profiles, users } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { parsePhoneNumber, toGoTruePhoneFormat } from '../notification/schemas';
import {
  confirmPhoneSignupCode,
  discardUnconfirmedPhoneSignup,
  requestPhoneSignupCode,
} from './phoneSignup';

const PHONE = parsePhoneNumber('+15005550010');
const LISTED_CODE = '567890';

const readAuthUser = async () => {
  const [row] = await db
    .select({ id: authUsers.id, phoneConfirmedAt: authUsers.phoneConfirmedAt })
    .from(authUsers)
    .where(eq(authUsers.phone, toGoTruePhoneFormat(PHONE)))
    .limit(1);
  return row ?? null;
};

describe('phoneSignup against GoTrue', () => {
  it('given a code was requested, when a wrong code is confirmed, then GoTrue reports it as expired or invalid and the number stays unconfirmed', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestPhoneAuthDataManager(task.id, onTestFinished);
    testData.cleanupByPhoneOnFinish(PHONE);
    await expect(requestPhoneSignupCode({ phone: PHONE })).resolves.toEqual({
      status: 'sent',
    });

    const result = await confirmPhoneSignupCode({
      phone: PHONE,
      token: '000000',
    });

    expect(result).toEqual({
      status: 'rejected',
      reason: 'expired_or_invalid',
    });
    expect((await readAuthUser())?.phoneConfirmedAt).toBeNull();
  });

  it('given no code was requested, when a code is confirmed, then GoTrue reports it as expired or invalid', async () => {
    expect(await readAuthUser()).toBeNull();

    const result = await confirmPhoneSignupCode({
      phone: PHONE,
      token: LISTED_CODE,
    });

    expect(result).toEqual({
      status: 'rejected',
      reason: 'expired_or_invalid',
    });
  });

  it('given a code was requested, when the listed code is confirmed, then the number is confirmed and the auth user id comes back', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestPhoneAuthDataManager(task.id, onTestFinished);
    testData.cleanupByPhoneOnFinish(PHONE);
    await requestPhoneSignupCode({ phone: PHONE });

    const result = await confirmPhoneSignupCode({
      phone: PHONE,
      token: LISTED_CODE,
    });

    const authUser = await readAuthUser();
    expect(authUser?.phoneConfirmedAt).not.toBeNull();
    expect(result).toEqual({ status: 'confirmed', authUserId: authUser?.id });
  });
});

describe('discardUnconfirmedPhoneSignup against GoTrue', () => {
  const minutesAgo = (minutes: number) =>
    new Date(Date.now() - minutes * 60_000);

  const readProfileIdOf = async (authUserId: string) => {
    const [row] = await db
      .select({ profileId: users.profileId })
      .from(users)
      .where(eq(users.authUserId, authUserId))
      .limit(1);
    return row?.profileId ?? null;
  };

  const profileExists = async (profileId: string) => {
    const [row] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .limit(1);
    return row !== undefined;
  };

  it('given an unconfirmed row whose code was sent before the bound, when discarded, then the auth user and the profile the trigger created are gone', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestPhoneAuthDataManager(task.id, onTestFinished);
    const authUserId = await testData.createUser({
      phone: PHONE,
      confirmed: false,
      codeSentAt: minutesAgo(1),
    });
    const profileId = await readProfileIdOf(authUserId);
    if (profileId === null) {
      throw new Error('The signup trigger created no profile for the test row');
    }

    const result = await discardUnconfirmedPhoneSignup({
      phone: PHONE,
      codeSentNoLaterThan: new Date(),
    });

    expect(result).toEqual({ status: 'discarded', authUserId });
    expect(await readAuthUser()).toBeNull();
    expect(await profileExists(profileId)).toBe(false);
  });

  it('given a confirmed row, when discarded, then it is kept', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestPhoneAuthDataManager(task.id, onTestFinished);
    const authUserId = await testData.createUser({
      phone: PHONE,
      confirmed: true,
      codeSentAt: minutesAgo(1),
    });

    const result = await discardUnconfirmedPhoneSignup({
      phone: PHONE,
      codeSentNoLaterThan: new Date(),
    });

    expect(result).toEqual({ status: 'kept', reason: 'confirmed' });
    expect((await readAuthUser())?.id).toBe(authUserId);
  });

  it('given an unconfirmed row whose code was sent after the bound, when discarded, then it is kept for the newer attempt', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestPhoneAuthDataManager(task.id, onTestFinished);
    const authUserId = await testData.createUser({
      phone: PHONE,
      confirmed: false,
      codeSentAt: new Date(),
    });

    const result = await discardUnconfirmedPhoneSignup({
      phone: PHONE,
      codeSentNoLaterThan: minutesAgo(1),
    });

    expect(result).toEqual({ status: 'kept', reason: 'newer_attempt' });
    expect((await readAuthUser())?.id).toBe(authUserId);
  });

  it('given no row for the number, when discarded, then nothing is deleted', async () => {
    expect(await readAuthUser()).toBeNull();

    const result = await discardUnconfirmedPhoneSignup({
      phone: PHONE,
      codeSentNoLaterThan: new Date(),
    });

    expect(result).toEqual({ status: 'kept', reason: 'no_row' });
  });
});
