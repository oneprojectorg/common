import { mockCollab, textFragment } from '@op/collab/testing';
import { TestDecisionsDataManager } from '@op/common/testing';
import { db } from '@op/db/client';
import { ProcessStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { getBallotProposalByCode } from './getBallotProposalByCode';
import { listBallotProposals } from './listBallotProposals';
import { parseProposalData } from './proposalDataSchema';
import { rejectProposal } from './rejectProposal';
import type { DecisionSchemaDefinition } from './schemas/types';
import { submitProposal } from './submitProposal';

const votingSchema: DecisionSchemaDefinition = {
  id: 'sms-ballot-reads',
  version: '1.0.0',
  name: 'SMS ballot reads',
  description: 'A submission phase followed by a budgeted voting phase',
  phases: [
    {
      id: 'submission',
      name: 'Submission',
      rules: { proposals: { submit: true }, voting: { submit: false } },
      selectionPipeline: {
        version: '1.0.0',
        blocks: [{ id: 'all', type: 'limit', count: 10 }],
      },
    },
    {
      id: 'voting',
      name: 'Voting',
      rules: {
        proposals: { submit: false },
        voting: { submit: true, voterBudget: 1_000_000 },
      },
    },
  ],
};

const proposalTemplate = {
  type: 'object',
  required: ['title'],
  'x-field-order': ['title', 'budget', 'summary'],
  properties: {
    title: { type: 'string', title: 'Title', 'x-format': 'short-text' },
    budget: {
      type: 'object',
      title: 'Budget',
      'x-format': 'money',
      properties: {
        amount: { type: 'number' },
        currency: { type: 'string', default: 'USD' },
      },
    },
    summary: { type: 'string', title: 'Summary', 'x-format': 'long-text' },
  },
};

const readInstance = async (instanceId: string) => {
  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
    columns: {
      id: true,
      instanceData: true,
      currentStateId: true,
      processId: true,
    },
  });
  if (!instance) {
    throw new Error(`Instance ${instanceId} not found`);
  }
  return instance;
};

const seedVotingDecision = async (
  testData: TestDecisionsDataManager,
  proposals: ReadonlyArray<{
    title: string;
    budget: number;
    description?: string;
  }>,
) => {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
    status: ProcessStatus.PUBLISHED,
    processSchema: votingSchema,
    proposalTemplate,
  });
  const instanceId = setup.instance.instance.id;
  const submitted = [];
  for (const { title, budget, description } of proposals) {
    const draft = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title, budget },
    });
    const { collaborationDocId } = parseProposalData(draft.proposalData);
    if (!collaborationDocId) {
      throw new Error(
        `Draft ${draft.id} was created without a collaboration document`,
      );
    }
    mockCollab.setDocFragmentResponses(collaborationDocId, {
      title: textFragment(title),
      budget: textFragment(JSON.stringify({ amount: budget, currency: 'USD' })),
      ...(description ? { summary: textFragment(description) } : {}),
    });
    submitted.push(
      await submitProposal({
        data: { proposalId: draft.id },
        authUserId: setup.user.id,
      }),
    );
  }
  return { setup, instanceId, submitted };
};

describe.concurrent('listBallotProposals', () => {
  it('given three submitted proposals in a voting phase, when the ballot is listed, then they come back in code order with their titles and costs', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await seedVotingDecision(testData, [
      { title: 'Crosswalk lighting', budget: 85_000 },
      { title: 'Rec center hours', budget: 240_000 },
      { title: 'Tree planting', budget: 150_000 },
    ]);
    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'voting',
    });

    const page = await listBallotProposals({
      instance: await readInstance(instanceId),
      limit: 10,
    });

    expect(
      page.items.map(({ code, title, cost }) => [code, title, cost]),
    ).toEqual([
      [101, 'Crosswalk lighting', '$85,000'],
      [102, 'Rec center hours', '$240,000'],
      [103, 'Tree planting', '$150,000'],
    ]);
    expect(page.nextCursor).toBeNull();
    expect(setup.instance.instance.id).toBe(instanceId);
  });

  it('given one proposal whose cost is not a valid amount, when the ballot is listed, then the page still comes back and only that proposal has no cost', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, submitted } = await seedVotingDecision(testData, [
      { title: 'Crosswalk lighting', budget: 85_000 },
      { title: 'Rec center hours', budget: 240_000 },
    ]);
    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'voting',
    });
    const broken = parseProposalData(submitted[1]?.proposalData);
    if (!broken.collaborationDocId) {
      throw new Error('The second proposal has no collaboration document');
    }
    mockCollab.setDocFragmentResponses(broken.collaborationDocId, {
      title: textFragment('Rec center hours'),
      budget: textFragment('about a quarter million'),
    });

    const page = await listBallotProposals({
      instance: await readInstance(instanceId),
      limit: 10,
    });

    expect(
      page.items.map(({ code, title, cost }) => [code, title, cost]),
    ).toEqual([
      [101, 'Crosswalk lighting', '$85000'],
      [102, 'Rec center hours', null],
    ]);
  });

  it('given more proposals than one page holds, when the next page is asked for after the cursor, then it starts at the next code and ends the paging', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId } = await seedVotingDecision(testData, [
      { title: 'One', budget: 1 },
      { title: 'Two', budget: 2 },
      { title: 'Three', budget: 3 },
    ]);
    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'voting',
    });
    const instance = await readInstance(instanceId);

    const first = await listBallotProposals({ instance, limit: 2 });
    const second = await listBallotProposals({
      instance,
      limit: 2,
      after: first.nextCursor ?? undefined,
    });

    expect(first.items.map(({ code }) => code)).toEqual([101, 102]);
    expect(first.nextCursor).toBe(102);
    expect(second.items.map(({ code }) => code)).toEqual([103]);
    expect(second.nextCursor).toBeNull();
  });

  it('given a rejected proposal and a draft beside a submitted one, when the ballot is listed, then only the submitted proposal is on it', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, submitted } = await seedVotingDecision(
      testData,
      [
        { title: 'Kept', budget: 10 },
        { title: 'Rejected', budget: 20 },
      ],
    );
    await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: 'Draft', budget: 30 },
    });
    await rejectProposal({ proposalId: submitted[1]!.id, user: setup.user });
    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'voting',
    });

    const page = await listBallotProposals({
      instance: await readInstance(instanceId),
      limit: 10,
    });

    expect(page.items.map(({ title }) => title)).toEqual(['Kept']);
  });
});

describe.concurrent('getBallotProposalByCode', () => {
  it('given a code on the ballot, when it is looked up, then the proposal comes back with its title, cost and summary', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId } = await seedVotingDecision(testData, [
      {
        title: 'Crosswalk lighting',
        budget: 85_000,
        description: 'Lights at the Fifth Avenue crossing.',
      },
    ]);
    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'voting',
    });

    const proposal = await getBallotProposalByCode({
      instance: await readInstance(instanceId),
      code: 101,
    });

    expect(proposal).toMatchObject({
      code: 101,
      title: 'Crosswalk lighting',
      cost: '$85,000',
      summary: 'Lights at the Fifth Avenue crossing.',
    });
  });

  it('given a code no proposal in this decision has, when it is looked up, then nothing comes back', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId } = await seedVotingDecision(testData, [
      { title: 'Only one', budget: 5 },
    ]);
    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'voting',
    });

    await expect(
      getBallotProposalByCode({
        instance: await readInstance(instanceId),
        code: 999,
      }),
    ).resolves.toBeNull();
  });

  it('given a rejected proposal, when its code is looked up, then nothing comes back because it is off the ballot', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, submitted } = await seedVotingDecision(
      testData,
      [{ title: 'Gone', budget: 5 }],
    );
    await rejectProposal({ proposalId: submitted[0]!.id, user: setup.user });
    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'voting',
    });

    await expect(
      getBallotProposalByCode({
        instance: await readInstance(instanceId),
        code: 101,
      }),
    ).resolves.toBeNull();
  });
});
