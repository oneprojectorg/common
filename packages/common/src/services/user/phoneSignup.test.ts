import { TestPhoneAuthDataManager } from '@op/common/testing';
import { db, eq } from '@op/db/client';
import { authUsers } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { parsePhoneNumber, toGoTruePhoneFormat } from '../notification/schemas';
import { confirmPhoneSignupCode, requestPhoneSignupCode } from './phoneSignup';

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
