import { TestDecisionsDataManager } from '@op/common/testing';
import { db } from '@op/db/client';
import {
  decisionsVoteDraftProposals,
  decisionsVoteDrafts,
} from '@op/db/schema';
import { eq } from 'drizzle-orm';
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
    userEmail: setup.user.email,
  };
};

const seedDraft = async (key: {
  processInstanceId: string;
  profileId: string;
}) => {
  const [draft] = await db
    .insert(decisionsVoteDrafts)
    .values(key)
    .returning({ id: decisionsVoteDrafts.id });
  if (!draft) {
    throw new Error('draft insert returned no row');
  }
  return draft.id;
};

const seedProposal = async (
  testData: TestDecisionsDataManager,
  voter: { processInstanceId: string; userEmail: string },
  title: string,
) => {
  const proposal = await testData.createProposal({
    userEmail: voter.userEmail,
    processInstanceId: voter.processInstanceId,
    proposalData: { title },
  });
  return proposal.id;
};

describe.concurrent('decisions_vote_drafts', () => {
  it('given a draft with three ranked picks, when the picks are read back by rank, then the ballot order holds', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const voter = await seedVoter(testData);
    const draftId = await seedDraft(voter);
    const first = await seedProposal(testData, voter, 'First pick');
    const second = await seedProposal(testData, voter, 'Second pick');
    const third = await seedProposal(testData, voter, 'Third pick');

    await db.insert(decisionsVoteDraftProposals).values([
      { voteDraftId: draftId, proposalId: third, rank: 3 },
      { voteDraftId: draftId, proposalId: first, rank: 1 },
      { voteDraftId: draftId, proposalId: second, rank: 2 },
    ]);

    const picks = await db.query.decisionsVoteDraftProposals.findMany({
      where: { voteDraftId: draftId },
      orderBy: { rank: 'asc' },
    });
    expect(picks.map((pick) => pick.proposalId)).toEqual([
      first,
      second,
      third,
    ]);
  });

  it('given a voter already has a draft in a decision, when a second draft is inserted for them, then the unique index refuses it', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const voter = await seedVoter(testData);
    const key = {
      processInstanceId: voter.processInstanceId,
      profileId: voter.profileId,
    };
    await db.insert(decisionsVoteDrafts).values(key);

    await expect(
      db.insert(decisionsVoteDrafts).values(key),
    ).rejects.toMatchObject({ cause: { code: '23505' } });
  });

  it('given a proposal already picked in a draft, when the same proposal is picked again, then the primary key refuses it', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const voter = await seedVoter(testData);
    const draftId = await seedDraft(voter);
    const proposalId = await seedProposal(testData, voter, 'Only pick');
    await db
      .insert(decisionsVoteDraftProposals)
      .values({ voteDraftId: draftId, proposalId, rank: 1 });

    await expect(
      db
        .insert(decisionsVoteDraftProposals)
        .values({ voteDraftId: draftId, proposalId, rank: 2 }),
    ).rejects.toMatchObject({ cause: { code: '23505' } });
  });

  it('given two picks that claim the same rank in one draft, when the second is inserted, then the rank index refuses it', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const voter = await seedVoter(testData);
    const draftId = await seedDraft(voter);
    const first = await seedProposal(testData, voter, 'First pick');
    const second = await seedProposal(testData, voter, 'Second pick');
    await db
      .insert(decisionsVoteDraftProposals)
      .values({ voteDraftId: draftId, proposalId: first, rank: 1 });

    await expect(
      db
        .insert(decisionsVoteDraftProposals)
        .values({ voteDraftId: draftId, proposalId: second, rank: 1 }),
    ).rejects.toMatchObject({ cause: { code: '23505' } });
  });

  it('given a draft with a pick, when the draft is deleted, then its pick rows are deleted with it', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const voter = await seedVoter(testData);
    const draftId = await seedDraft(voter);
    const proposalId = await seedProposal(testData, voter, 'Only pick');
    await db
      .insert(decisionsVoteDraftProposals)
      .values({ voteDraftId: draftId, proposalId, rank: 1 });

    await db
      .delete(decisionsVoteDrafts)
      .where(eq(decisionsVoteDrafts.id, draftId));

    await expect(
      db.query.decisionsVoteDraftProposals.findMany({
        where: { voteDraftId: draftId },
      }),
    ).resolves.toEqual([]);
  });
});
