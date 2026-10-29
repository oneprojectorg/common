import { TestDecisionsDataManager } from '@op/common/testing';
import { db, sql } from '@op/db/client';
import { decisionsVoteDrafts } from '@op/db/schema';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { getIndividualProfileId } from '../access';

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

describe.concurrent('decisions_vote_drafts', () => {
  it('given a draft with three picks, when it is read back, then the picks keep their order and the cursor is null', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const key = await seedVoter(testData);
    const picks = [randomUUID(), randomUUID(), randomUUID()];

    await db.insert(decisionsVoteDrafts).values({ ...key, picks });

    await expect(
      db.query.decisionsVoteDrafts.findFirst({ where: key }),
    ).resolves.toMatchObject({ picks, pageCursor: null });
  });

  it('given a voter already has a draft in a decision, when a second draft is inserted for them, then the unique index refuses it', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const key = await seedVoter(testData);
    await db.insert(decisionsVoteDrafts).values({ ...key, picks: [] });

    await expect(
      db.insert(decisionsVoteDrafts).values({ ...key, picks: [] }),
    ).rejects.toMatchObject({ cause: { code: '23505' } });
  });

  it('given picks that are not a JSON array, planted with a raw insert because no service writes one, then the check constraint refuses the row', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const key = await seedVoter(testData);

    await expect(
      db.execute(
        sql`insert into decisions_vote_drafts (process_instance_id, profile_id, picks) values (${key.processInstanceId}, ${key.profileId}, '{"a":1}'::jsonb)`,
      ),
    ).rejects.toMatchObject({ cause: { code: '23514' } });
    await expect(
      db.query.decisionsVoteDrafts.findFirst({ where: key }),
    ).resolves.toBeUndefined();
  });
});
