import { TestDecisionsDataManager } from '@op/common/testing';
import { createDecisionPhoneNumber } from '@op/common/testing/data';
import { db } from '@op/db/client';
import { describe, expect, it } from 'vitest';

import { findDecisionPhoneNumber } from './decisionPhoneNumber';

const NUMBERS = {
  lookup: '+16145550110',
  unbound: '+16145550111',
  whatsappOnly: '+16145550112',
} as const;

describe.concurrent('findDecisionPhoneNumber', () => {
  it('given a number bound to a decision for sms, when a text arrives on that number, then it resolves to the decision and its slug', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 1 });
    const instanceId = setup.instance.instance.id;
    const profile = await db.query.profiles.findFirst({
      where: { id: setup.instance.profileId },
      columns: { slug: true },
    });
    const number = await createDecisionPhoneNumber({
      processInstanceId: instanceId,
      phoneNumber: NUMBERS.lookup,
    });

    await expect(
      findDecisionPhoneNumber({ phone: NUMBERS.lookup }),
    ).resolves.toEqual({
      id: number.id,
      phone: NUMBERS.lookup,
      instanceId,
      slug: profile?.slug,
    });
  });

  it('given a number bound only for whatsapp, when an sms arrives on it, then no decision resolves', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 1 });
    await createDecisionPhoneNumber({
      processInstanceId: setup.instance.instance.id,
      phoneNumber: NUMBERS.whatsappOnly,
      channel: 'whatsapp',
    });

    await expect(
      findDecisionPhoneNumber({ phone: NUMBERS.whatsappOnly }),
    ).resolves.toBeNull();
  });

  it('given a number no decision holds, when a text arrives on it, then no decision resolves', async () => {
    await expect(
      findDecisionPhoneNumber({ phone: NUMBERS.unbound }),
    ).resolves.toBeNull();
  });

  it('given text that is not a phone number, when a decision is looked up for it, then no decision resolves', async () => {
    await expect(
      findDecisionPhoneNumber({ phone: 'not a number' }),
    ).resolves.toBeNull();
  });
});
