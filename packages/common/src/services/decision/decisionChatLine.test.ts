import { TestDecisionsDataManager } from '@op/common/testing';
import { createDecisionChatLine } from '@op/common/testing/data';
import { db } from '@op/db/client';
import { describe, expect, it } from 'vitest';

import { findChatLine } from './decisionChatLine';

const NUMBERS = {
  lookup: '+16145550110',
  unbound: '+16145550111',
} as const;

describe.concurrent('findChatLine', () => {
  it('given a number bound to a decision, when a text arrives on that number, then the line resolves to the decision and its slug', async ({
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
    await createDecisionChatLine({
      processInstanceId: instanceId,
      phoneNumber: NUMBERS.lookup,
    });

    await expect(findChatLine({ phone: NUMBERS.lookup })).resolves.toEqual({
      phone: NUMBERS.lookup,
      instanceId,
      slug: profile?.slug,
    });
  });

  it('given a number no decision holds, when a text arrives on it, then no line resolves', async () => {
    await expect(findChatLine({ phone: NUMBERS.unbound })).resolves.toBeNull();
  });

  it('given text that is not a phone number, when a line is looked up for it, then no line resolves', async () => {
    await expect(findChatLine({ phone: 'not a number' })).resolves.toBeNull();
  });
});
