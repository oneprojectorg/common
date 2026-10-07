import { TestPhoneAuthDataManager } from '@op/common/testing';
import { randomInt } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { type PhoneNumber, parsePhoneNumber } from '../notification/schemas';
import {
  PHONE_SIGNUP_REPLY_WINDOW_MINUTES,
  getPhoneSignupState,
} from './getPhoneSignupState';

/**
 * A number in Twilio's reserved test range, generated with four digits and no
 * leading zero, so it never equals one of the `[auth.sms.test_otp]` numbers
 * (which all start with 0) that the workflow tests claim on this instance.
 */
const testPhone = () =>
  parsePhoneNumber(`+1500555${String(randomInt(1000, 9999))}`);

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

const createPhoneUser = (
  testData: TestPhoneAuthDataManager,
  options: { phone: PhoneNumber; confirmed: boolean; codeSentAt?: Date },
) => testData.createUser(options);

describe.concurrent('getPhoneSignupState', () => {
  it('given a number no auth row holds, when looked up, then the number is free', async () => {
    const state = await getPhoneSignupState({ phone: testPhone() });

    expect(state).toEqual({ status: 'free' });
  });

  it('given an unconfirmed row that was never sent a code, when looked up, then the number is free', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestPhoneAuthDataManager(task.id, onTestFinished);
    const phone = testPhone();
    await createPhoneUser(testData, { phone, confirmed: false });

    const state = await getPhoneSignupState({ phone });

    expect(state).toEqual({ status: 'free' });
  });

  it('given an unconfirmed row sent a code inside the reply window, when looked up, then an attempt is in progress', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestPhoneAuthDataManager(task.id, onTestFinished);
    const phone = testPhone();
    const codeSentAt = minutesAgo(1);
    await createPhoneUser(testData, {
      phone,
      confirmed: false,
      codeSentAt,
    });

    const state = await getPhoneSignupState({ phone });

    expect(state).toEqual({ status: 'attempt_in_progress', codeSentAt });
  });

  it('given an unconfirmed row sent a code before the reply window opened, when looked up, then the number is free again', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestPhoneAuthDataManager(task.id, onTestFinished);
    const phone = testPhone();
    await createPhoneUser(testData, {
      phone,
      confirmed: false,
      codeSentAt: minutesAgo(PHONE_SIGNUP_REPLY_WINDOW_MINUTES + 1),
    });

    const state = await getPhoneSignupState({ phone });

    expect(state).toEqual({ status: 'free' });
  });

  it('given a confirmed row, when looked up, then it is the account, whatever the last send time', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestPhoneAuthDataManager(task.id, onTestFinished);
    const phone = testPhone();
    const authUserId = await createPhoneUser(testData, {
      phone,
      confirmed: true,
      codeSentAt: minutesAgo(1),
    });

    const state = await getPhoneSignupState({ phone });

    expect(state).toEqual({
      status: 'confirmed',
      authUserId,
      profileId: expect.any(String),
    });
  });
});
