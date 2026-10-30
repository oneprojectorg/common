import { TestDecisionsDataManager } from '@op/common/testing';
import { db } from '@op/db/client';
import { decisionChatSessions, decisionPhoneNumbers } from '@op/db/schema';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { getIndividualProfileId } from '../access';

const NUMBERS = {
  bound: '+17405550110',
} as const;

const seedVoter = async (testData: TestDecisionsDataManager) => {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
  });
  return {
    processInstanceId: setup.instance.instance.id,
    profileId: await getIndividualProfileId(setup.user.id),
  };
};

describe.concurrent('decision_chat_sessions', () => {
  it('given a voter already has a session in a decision, when a second session is inserted for them, then the unique index refuses it', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const key = await seedVoter(testData);
    await db.insert(decisionChatSessions).values(key);

    await expect(
      db.insert(decisionChatSessions).values(key),
    ).rejects.toMatchObject({ cause: { code: '23505' } });
  });

  it('given a session bound to a decision phone number, when the number is deleted, then the session stays and its number clears', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const key = await seedVoter(testData);
    const [line] = await db
      .insert(decisionPhoneNumbers)
      .values({
        processInstanceId: key.processInstanceId,
        phoneNumber: NUMBERS.bound,
      })
      .returning({ id: decisionPhoneNumbers.id });
    if (!line) {
      throw new Error('phone number insert returned no row');
    }
    await db
      .insert(decisionChatSessions)
      .values({ ...key, phoneNumberId: line.id, pageCursor: 2 });

    await db
      .delete(decisionPhoneNumbers)
      .where(eq(decisionPhoneNumbers.id, line.id));

    await expect(
      db.query.decisionChatSessions.findFirst({ where: key }),
    ).resolves.toMatchObject({ phoneNumberId: null, pageCursor: 2 });
  });
});
