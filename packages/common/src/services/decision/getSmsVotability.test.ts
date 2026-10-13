import { TestDecisionsDataManager } from '@op/common/testing';
import { db, eq } from '@op/db/client';
import { ProcessStatus, ProposalStatus, moderationFlags } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { createAutomatedFlag } from '../moderation/moderationFlagStore';
import { getSmsVotability } from './getSmsVotability';
import type { DecisionSchemaDefinition } from './schemas/types';

const votingPhase = {
  id: 'voting',
  name: 'Voting',
  rules: {
    proposals: { submit: false },
    voting: { submit: true, maxVotesPerMember: 1 },
  },
};

const shortlistSchema: DecisionSchemaDefinition = {
  id: 'sms-shortlist-votability',
  version: '1.0.0',
  name: 'SMS Shortlist Votability',
  description: 'A submission phase that advances two proposals into voting',
  phases: [
    {
      id: 'submission',
      name: 'Submission',
      rules: { proposals: { submit: true }, voting: { submit: false } },
      selectionPipeline: {
        version: '1.0.0',
        blocks: [{ id: 'shortlist', type: 'limit', count: 2 }],
      },
    },
    votingPhase,
  ],
};

describe.concurrent('getSmsVotability', () => {
  it('given a selection phase advanced two of three proposals into voting, then only the advanced proposals are counted', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      status: ProcessStatus.PUBLISHED,
      processSchema: shortlistSchema,
    });
    const instanceId = setup.instance.instance.id;
    await Promise.all(
      ['One', 'Two', 'Three'].map((title) =>
        testData.createProposal({
          userEmail: setup.userEmail,
          processInstanceId: instanceId,
          proposalData: { title: `${title} ${task.id}` },
          status: ProposalStatus.SUBMITTED,
        }),
      ),
    );
    const advanced = await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'voting',
    });
    expect(advanced).toMatchObject({ conflict: false });

    const votability = await getSmsVotability({
      processInstanceId: instanceId,
      phase: votingPhase,
    });

    expect(votability).toEqual({
      votingOpen: true,
      eligibleProposalCount: 2,
      maxVotesPerMember: 1,
    });
  });

  it('given one of two advanced proposals is under an open moderation flag, then only the other is counted', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      status: ProcessStatus.PUBLISHED,
      processSchema: shortlistSchema,
    });
    const instanceId = setup.instance.instance.id;
    const [flagged] = await Promise.all(
      ['Flagged', 'Clean'].map((title) =>
        testData.createProposal({
          userEmail: setup.userEmail,
          processInstanceId: instanceId,
          proposalData: { title: `${title} ${task.id}` },
          status: ProposalStatus.SUBMITTED,
        }),
      ),
    );
    const advanced = await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'voting',
    });
    expect(advanced).toMatchObject({ conflict: false });
    const { flag } = await createAutomatedFlag({
      itemType: 'proposal',
      itemId: flagged!.id,
    });
    onTestFinished(async () => {
      await db.delete(moderationFlags).where(eq(moderationFlags.id, flag.id));
    });

    const votability = await getSmsVotability({
      processInstanceId: instanceId,
      phase: votingPhase,
    });

    expect(votability).toMatchObject({ eligibleProposalCount: 1 });
  });
});
