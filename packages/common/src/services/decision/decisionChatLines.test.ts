import { TestDecisionsDataManager } from '@op/common/testing';
import { db, sql } from '@op/db/client';
import { decisionChatLines } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

const NUMBERS = {
  second: '+17405550101',
  shared: '+17405550102',
  malformed: '+17405550103',
} as const;

const seedDecisions = async (
  testData: TestDecisionsDataManager,
  instanceCount: number,
) => {
  const setup = await testData.createDecisionSetup({
    instanceCount,
    grantAccess: true,
  });
  return setup.instances.map((entry) => entry.instance.id);
};

describe.concurrent('decision_chat_lines', () => {
  it('given a decision already has a line, when a second line is inserted for it, then the unique index refuses the row', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const [processInstanceId] = await seedDecisions(testData, 1);
    await db.insert(decisionChatLines).values({
      processInstanceId: processInstanceId!,
      phoneNumber: NUMBERS.second,
    });

    await expect(
      db.insert(decisionChatLines).values({
        processInstanceId: processInstanceId!,
        phoneNumber: '+17405550199',
      }),
    ).rejects.toMatchObject({ cause: { code: '23505' } });
  });

  it('given a number bound to one decision, when it is bound to a second decision, then the unique index refuses the row', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const [first, second] = await seedDecisions(testData, 2);
    await db
      .insert(decisionChatLines)
      .values({ processInstanceId: first!, phoneNumber: NUMBERS.shared });

    await expect(
      db
        .insert(decisionChatLines)
        .values({ processInstanceId: second!, phoneNumber: NUMBERS.shared }),
    ).rejects.toMatchObject({ cause: { code: '23505' } });
    await expect(
      db.query.decisionChatLines.findFirst({
        where: { processInstanceId: second! },
      }),
    ).resolves.toBeUndefined();
  });

  it('given a number that is not E.164, planted with a raw insert because no service writes one, then the check constraint refuses the row', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const [processInstanceId] = await seedDecisions(testData, 1);

    await expect(
      db.execute(
        sql`insert into decision_chat_lines (process_instance_id, phone_number) values (${processInstanceId}, ${NUMBERS.malformed.slice(1)})`,
      ),
    ).rejects.toMatchObject({ cause: { code: '23514' } });
    await expect(
      db.query.decisionChatLines.findFirst({
        where: { processInstanceId: processInstanceId! },
      }),
    ).resolves.toBeUndefined();
  });
});
