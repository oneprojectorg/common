import { TestDecisionsDataManager } from '@op/common/testing';
import { db } from '@op/db/client';
import { decisionVoterEnrolments, taxonomyTerms } from '@op/db/schema';
import { eq } from 'drizzle-orm';
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

describe.concurrent('decision_voter_enrolments', () => {
  it('given a fresh registration row, when it is read back, then no district is resolved and the voter has not agreed', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const key = await seedVoter(testData);

    await db.insert(decisionVoterEnrolments).values(key);

    await expect(
      db.query.decisionVoterEnrolments.findFirst({ where: key }),
    ).resolves.toMatchObject({
      taxonomyTermId: null,
      enrolledAt: null,
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

  it('given an enrolment resolved to a district term, when the term is deleted, then the enrolment stays and its district clears', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const key = await seedVoter(testData);
    const [term] = await db
      .insert(taxonomyTerms)
      .values({ termUri: randomUUID(), label: 'District 1' })
      .returning({ id: taxonomyTerms.id });
    if (!term) {
      throw new Error('term insert returned no row');
    }
    await db
      .insert(decisionVoterEnrolments)
      .values({ ...key, taxonomyTermId: term.id, enrolledAt: new Date() });

    await db.delete(taxonomyTerms).where(eq(taxonomyTerms.id, term.id));

    await expect(
      db.query.decisionVoterEnrolments.findFirst({ where: key }),
    ).resolves.toMatchObject({ taxonomyTermId: null });
  });
});
