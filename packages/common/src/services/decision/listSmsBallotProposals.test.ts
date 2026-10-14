import { TestDecisionsDataManager } from '@op/common/testing';
import { db, eq } from '@op/db/client';
import {
  ProcessStatus,
  ProposalStatus,
  moderationFlags,
  proposals,
} from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { createAutomatedFlag } from '../moderation/moderationFlagStore';
import { deleteProposal } from './deleteProposal';
import { listSmsBallotProposals } from './listSmsBallotProposals';
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

describe.concurrent('listSmsBallotProposals', () => {
  it('given a proposal submitted in a phase that hides submissions by default, then it gets no ballot code', async ({
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
    const hidden = await testData.createProposal({
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

    const rows = await listSmsBallotProposals({
      processInstanceId: instanceId,
    });

    expect(rows.map((row) => row.proposalId)).not.toContain(hidden.id);
  });

  it('given a proposal under an open moderation flag, then it gets no ballot code', async ({
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
    const [flagged, clean] = await Promise.all(
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

    const rows = await listSmsBallotProposals({
      processInstanceId: instanceId,
    });

    expect(rows.map((row) => row.proposalId)).toEqual([clean!.id]);
  });

  it('given the first of two advanced proposals is later rejected (rejected directly: rejection needs an admin session), then the other keeps its code', async ({
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
    const first = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `First ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });
    const second = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Second ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });
    const advanced = await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'voting',
    });
    expect(advanced).toMatchObject({ conflict: false });
    const before = await listSmsBallotProposals({
      processInstanceId: instanceId,
    });
    await db
      .update(proposals)
      .set({ status: ProposalStatus.REJECTED })
      .where(eq(proposals.id, first.id));

    const after = await listSmsBallotProposals({
      processInstanceId: instanceId,
    });

    expect(before.map((row) => [row.code, row.proposalId])).toEqual([
      ['101', first.id],
      ['102', second.id],
    ]);
    expect(after.map((row) => [row.code, row.proposalId])).toEqual([
      ['102', second.id],
    ]);
  });

  it('given the first of two advanced proposals is later deleted, then the other keeps its code', async ({
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
    const first = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `First ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });
    const second = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Second ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });
    const advanced = await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'voting',
    });
    expect(advanced).toMatchObject({ conflict: false });
    await deleteProposal({ proposalId: first.id, user: setup.user });

    const rows = await listSmsBallotProposals({
      processInstanceId: instanceId,
    });

    expect(rows.map((row) => [row.code, row.proposalId])).toEqual([
      ['102', second.id],
    ]);
  });

  it('given a selection phase advanced two of three proposals into voting, then only the advanced proposals are listed, each under the code of its creation order', async ({
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
    const submitted = [];
    for (const title of ['One', 'Two', 'Three']) {
      submitted.push(
        await testData.createProposal({
          userEmail: setup.userEmail,
          processInstanceId: instanceId,
          proposalData: { title: `${title} ${task.id}` },
          status: ProposalStatus.SUBMITTED,
        }),
      );
    }
    const advanced = await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'voting',
    });
    expect(advanced).toMatchObject({ conflict: false });

    const rows = await listSmsBallotProposals({
      processInstanceId: instanceId,
    });

    const submittedIds = submitted.map((proposal) => proposal.id);
    expect(rows).toHaveLength(2);
    expect(submittedIds).toEqual(
      expect.arrayContaining(rows.map((row) => row.proposalId)),
    );
    expect(rows.map((row) => row.code)).toEqual(['102', '103']);
  });

  it('given a legacy snapshot that stores the budget as a numeric string (planted directly, no service writes that shape), then the proposal carries that amount in the default currency', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, proposalId } = await seedProposal(
      task.id,
      onTestFinished,
      { budget: '85000' },
    );

    const rows = await listSmsBallotProposals({
      processInstanceId: instanceId,
    });

    expect(rows.find((row) => row.proposalId === proposalId)).toMatchObject({
      cost: 85_000,
      currency: 'USD',
    });
  });

  it('given a budget stored in the canonical shape, then the proposal carries its amount and currency', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, proposalId } = await seedProposal(
      task.id,
      onTestFinished,
      { budget: { amount: 12_500, currency: 'EUR' } },
    );

    const rows = await listSmsBallotProposals({
      processInstanceId: instanceId,
    });

    expect(rows.find((row) => row.proposalId === proposalId)).toMatchObject({
      cost: 12_500,
      currency: 'EUR',
    });
  });

  it('given a budget with no currency, then the proposal carries no cost rather than an invented one', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, proposalId } = await seedProposal(
      task.id,
      onTestFinished,
      { budget: { amount: 1_000 } },
    );

    const rows = await listSmsBallotProposals({
      processInstanceId: instanceId,
    });

    expect(rows.find((row) => row.proposalId === proposalId)).toMatchObject({
      cost: null,
    });
  });
});

const seedProposal = async (
  testId: string,
  onTestFinished: ConstructorParameters<typeof TestDecisionsDataManager>[1],
  extraProposalData: Record<string, unknown>,
) => {
  const testData = new TestDecisionsDataManager(testId, onTestFinished);
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
  });
  const proposal = await testData.createProposal({
    userEmail: setup.userEmail,
    processInstanceId: setup.instance.instance.id,
    proposalData: { title: `Proposal ${testId}` },
    status: ProposalStatus.SUBMITTED,
  });
  await db
    .update(proposals)
    .set({
      proposalData: { title: `Proposal ${testId}`, ...extraProposalData },
    })
    .where(eq(proposals.id, proposal.id));
  return { instanceId: setup.instance.instance.id, proposalId: proposal.id };
};
