import { TestDecisionsDataManager } from '@op/common/testing';
import { db, sql } from '@op/db/client';
import {
  DecisionVoterEnrolmentStatus,
  decisionVoterEnrolments,
} from '@op/db/schema';
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

describe.concurrent('decision_voter_enrolments', () => {
  it('given a registration row with no status, when it is read back, then it awaits an address with no district and no attestation', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const key = await seedVoter(testData);

    await db.insert(decisionVoterEnrolments).values(key);

    await expect(
      db.query.decisionVoterEnrolments.findFirst({ where: key }),
    ).resolves.toMatchObject({
      status: DecisionVoterEnrolmentStatus.AWAITING_ADDRESS,
      boundaryId: null,
      attestationHash: null,
      attestedAt: null,
    });
  });

  it('given a voter already has a registration in a decision, when a second row is inserted for them, then the unique index refuses it', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const key = await seedVoter(testData);
    await db.insert(decisionVoterEnrolments).values(key);

    await expect(
      db.insert(decisionVoterEnrolments).values(key),
    ).rejects.toMatchObject({ cause: { code: '23505' } });
  });

  it('given an enrolled row without its attestation hash or time, planted with a raw insert because no service writes one, then the check constraint refuses it', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const key = await seedVoter(testData);

    await expect(
      db.execute(
        sql`insert into decision_voter_enrolments (process_instance_id, profile_id, status) values (${key.processInstanceId}, ${key.profileId}, 'enrolled')`,
      ),
    ).rejects.toMatchObject({ cause: { code: '23514' } });
    await expect(
      db.execute(
        sql`insert into decision_voter_enrolments (process_instance_id, profile_id, status, attestation_hash) values (${key.processInstanceId}, ${key.profileId}, 'enrolled', 'abc')`,
      ),
    ).rejects.toMatchObject({ cause: { code: '23514' } });
    await expect(
      db.query.decisionVoterEnrolments.findFirst({ where: key }),
    ).resolves.toBeUndefined();
  });
});
