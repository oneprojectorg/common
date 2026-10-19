import { TestPhoneAuthDataManager } from '@op/common/testing';
import { db, eq, sql } from '@op/db/client';
import { authUsers } from '@op/db/schema';
import { randomInt } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { parsePhoneNumber, toGoTruePhoneFormat } from '../notification/schemas';
import { discardUnconfirmedPhoneSignup } from './discardUnconfirmedPhoneSignup';
import { getPhoneSignupState } from './getPhoneSignupState';

const testPhone = () =>
  parsePhoneNumber(`+1500555${String(randomInt(1000, 9999))}`);

describe.concurrent('discardUnconfirmedPhoneSignup', () => {
  it('given a code stamp with microseconds (planted directly: GoTrue stamps finer than a Date can carry), when the cutoff is that stamp read back, then the attempt is discarded', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestPhoneAuthDataManager(task.id, onTestFinished);
    const phone = testPhone();
    const authUserId = await testData.createUser({
      phone,
      confirmed: false,
      codeSentAt: new Date(Date.now() - 60_000),
    });
    await db
      .update(authUsers)
      .set({
        confirmationSentAt: sql`${authUsers.confirmationSentAt} + interval '123 microseconds'`,
      })
      .where(eq(authUsers.id, authUserId));
    const state = await getPhoneSignupState({ phone });
    if (state.status !== 'attempt_in_progress') {
      throw new Error(`Expected an attempt in progress, got ${state.status}`);
    }

    const result = await discardUnconfirmedPhoneSignup({
      phone,
      codeSentNoLaterThan: state.codeSentAt,
    });

    expect(result).toEqual({ status: 'discarded', authUserId });
    expect(
      await db
        .select({ id: authUsers.id })
        .from(authUsers)
        .where(eq(authUsers.phone, toGoTruePhoneFormat(phone))),
    ).toEqual([]);
  });

  it('given a code sent after the cutoff, when a discard is attempted, then the newer attempt is kept', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestPhoneAuthDataManager(task.id, onTestFinished);
    const phone = testPhone();
    const codeSentAt = new Date(Date.now() - 60_000);
    await testData.createUser({ phone, confirmed: false, codeSentAt });

    const result = await discardUnconfirmedPhoneSignup({
      phone,
      codeSentNoLaterThan: new Date(codeSentAt.getTime() - 1_000),
    });

    expect(result).toEqual({ status: 'kept', reason: 'newer_attempt' });
  });
});
