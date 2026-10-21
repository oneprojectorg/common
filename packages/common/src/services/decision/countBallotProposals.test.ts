import { TestDecisionsDataManager } from '@op/common/testing';
import { db, eq } from '@op/db/client';
import { ProcessStatus, ProposalStatus, moderationFlags } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { createAutomatedFlag } from '../moderation/moderationFlagStore';
import { countBallotProposals } from './countBallotProposals';
import type { DecisionSchemaDefinition } from './schemas/types';

const shortlistSchema: DecisionSchemaDefinition = {
  id: 'sms-shortlist',
  version: '1.0.0',
  name: 'SMS Shortlist',
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
    {
      id: 'voting',
      name: 'Voting',
      rules: {
        proposals: { submit: false },
        voting: { submit: true, maxVotesPerMember: 1 },
      },
    },
  ],
};

const hiddenSubmissionSchema: DecisionSchemaDefinition = {
  ...shortlistSchema,
  id: 'sms-shortlist-hidden',
  phases: shortlistSchema.phases.map((phase) =>
    phase.id === 'submission'
      ? {
          ...phase,
          rules: {
            ...phase.rules,
            proposals: { submit: true, defaults: { hidden: true } },
          },
        }
      : phase,
  ),
};

const readInstance = async (instanceId: string) => {
  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
    columns: { id: true, instanceData: true, currentStateId: true },
  });
  if (!instance) {
    throw new Error(`Instance ${instanceId} not found`);
  }
  return instance;
};

describe.concurrent('countBallotProposals', () => {
  it('given a proposal submitted in a phase that hides submissions by default, then it is not counted', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      status: ProcessStatus.PUBLISHED,
      processSchema: hiddenSubmissionSchema,
    });
    const instanceId = setup.instance.instance.id;
    await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Hidden ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });
    const advanced = await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'voting',
    });
    expect(advanced).toMatchObject({ conflict: false });

    await expect(
      countBallotProposals({ instance: await readInstance(instanceId) }),
    ).resolves.toBe(0);
  });

  it('given a proposal under an open moderation flag, then only the clean proposal is counted', async ({
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

    await expect(
      countBallotProposals({ instance: await readInstance(instanceId) }),
    ).resolves.toBe(1);
  });

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
    for (const title of ['One', 'Two', 'Three']) {
      await testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `${title} ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      });
    }
    const advanced = await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'voting',
    });
    expect(advanced).toMatchObject({ conflict: false });

    await expect(
      countBallotProposals({ instance: await readInstance(instanceId) }),
    ).resolves.toBe(2);
  });
});
