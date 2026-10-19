import { mockCollab } from '@op/collab/testing';
import type { BudgetData } from '@op/common/client';
import { TestDecisionsDataManager } from '@op/common/testing';
import { ProposalStatus, processInstances } from '@op/db/schema';
import { db, eq } from '@op/db/test';
import type { AmountUnit } from '@op/types/amountUnit';
import { describe, expect, it } from 'vitest';

import { appRouter } from '..';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating/decision';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

const USD: AmountUnit = { kind: 'currency', code: 'USD' };
const DOTS: AmountUnit = { kind: 'custom', label: 'dots' };

type PricedField = 'budget' | 'cost';

interface VotingSchemaOptions {
  maxVotesPerMember?: number;
  voterBudget?: number;
  voterCostField?: PricedField;
  /** Priced fields on the template; omit to leave it unpriced. */
  pricedFields?: PricedField[];
  ranked?: boolean;
}

const pricedFieldSchemas = {
  budget: {
    type: 'object',
    title: 'Budget',
    'x-format': 'money',
    properties: {
      amount: { type: 'number' },
      currency: { type: 'string', default: 'USD' },
    },
  },
  cost: { type: 'number', title: 'Cost', 'x-unit': DOTS },
} satisfies Record<PricedField, unknown>;

function buildProposalTemplate(pricedFields: PricedField[]) {
  return {
    type: 'object',
    properties: {
      title: { type: 'string', title: 'Title', 'x-format': 'short-text' },
      ...Object.fromEntries(
        pricedFields.map((field) => [field, pricedFieldSchemas[field]]),
      ),
    },
    required: ['title'],
  };
}

/**
 * Voting schema with three phases: submission, voting, results.
 * `maxVotesPerMember` can be overridden per test by caller-side edits to the returned object.
 */
function buildVotingSchema({
  maxVotesPerMember,
  voterBudget,
  voterCostField,
  pricedFields,
  ranked,
}: VotingSchemaOptions = {}) {
  return {
    id: 'voting-test',
    version: '1.0.0',
    name: 'Voting Test Schema',
    description: 'Schema for voting integration tests',
    ...(pricedFields && {
      proposalTemplate: buildProposalTemplate(pricedFields),
    }),
    phases: [
      {
        id: 'submission',
        name: 'Submission',
        rules: {
          proposals: { submit: true },
          voting: { submit: false },
          advancement: { method: 'manual' as const },
        },
      },
      {
        id: 'voting',
        name: 'Voting',
        rules: {
          proposals: { submit: false },
          voting: {
            submit: true,
            ...(maxVotesPerMember !== undefined && { maxVotesPerMember }),
            ...(voterBudget !== undefined && { voterBudget }),
            ...(voterCostField !== undefined && { voterCostField }),
            ...(ranked !== undefined && { ranked }),
          },
          advancement: { method: 'manual' as const },
        },
      },
      {
        id: 'results',
        name: 'Results',
        rules: {
          proposals: { submit: false },
          voting: { submit: false },
          advancement: { method: 'manual' as const },
        },
      },
    ],
  };
}

async function setupVotingInstance(
  testData: TestDecisionsDataManager,
  opts: VotingSchemaOptions & {
    proposalCount: number;
    votingEnabled?: boolean;
    /** Per-proposal priced values; `budget` is money, `cost` a dot count. */
    proposalPrices?: Array<{ budget?: BudgetData; cost?: number } | undefined>;
  },
) {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
    processSchema: buildVotingSchema(opts),
  });

  const instance = setup.instance;

  const proposals = await Promise.all(
    Array.from({ length: opts.proposalCount }, (_, i) =>
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: {
          title: `Proposal ${i + 1}`,
          ...opts.proposalPrices?.[i],
        },
        status: ProposalStatus.SUBMITTED,
      }),
    ),
  );

  // Voting prices from the live document, so it must match the snapshot.
  proposals.forEach((proposal, i) => {
    const { collaborationDocId } = proposal.proposalData as {
      collaborationDocId?: string;
    };
    const prices = opts.proposalPrices?.[i];

    if (collaborationDocId) {
      mockCollab.setDocFragments(collaborationDocId, {
        title: `Proposal ${i + 1}`,
        ...(prices?.budget && { budget: JSON.stringify(prices.budget) }),
        ...(prices?.cost !== undefined && { cost: String(prices.cost) }),
      });
    }
  });

  const targetPhase = opts.votingEnabled === false ? 'submission' : 'voting';
  await db
    .update(processInstances)
    .set({ currentStateId: targetPhase })
    .where(eq(processInstances.id, instance.instance.id));

  return { setup, instance, proposals };
}

describe.concurrent('submitVote', () => {
  it('rejects selection exceeding phase maxVotesPerMember', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      maxVotesPerMember: 2,
      proposalCount: 3,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.submitVote({
        processInstanceId: instance.instance.id,
        selectedProposalIds: proposals.map((p) => p.id),
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });

  it('accepts selection at the phase maxVotesPerMember cap', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      maxVotesPerMember: 2,
      proposalCount: 3,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: proposals.slice(0, 2).map((p) => p.id),
    });

    expect(result.selectedProposalIds).toHaveLength(2);
  });

  it('treats undefined maxVotesPerMember as unlimited', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      maxVotesPerMember: undefined,
      proposalCount: 5,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: proposals.map((p) => p.id),
    });

    expect(result.selectedProposalIds).toHaveLength(5);
  });

  it('rejects voting when phase disallows voting', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      proposalCount: 2,
      votingEnabled: false,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.submitVote({
        processInstanceId: instance.instance.id,
        selectedProposalIds: [proposals[0]!.id],
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });
});

describe.concurrent('submitVote knapsack budget', () => {
  async function getVoteData(voteSubmissionId: string) {
    const row = await db.query.decisionsVoteSubmissions.findFirst({
      where: { id: voteSubmissionId },
    });

    return row?.voteData;
  }

  it('accepts a ballot under the voter budget and snapshots what it enforced', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      voterBudget: 1000,
      pricedFields: ['budget'],
      proposalCount: 2,
      proposalPrices: [
        { budget: { amount: 300, currency: 'USD' } },
        { budget: { amount: 450, currency: 'USD' } },
      ],
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: proposals.map((p) => p.id),
    });

    expect(await getVoteData(result.id)).toMatchObject({
      voterBudget: 1000,
      voterCostField: 'budget',
      costUnit: USD,
      totalCost: 750,
      selections: [
        { proposalId: proposals[0]!.id, cost: 300 },
        { proposalId: proposals[1]!.id, cost: 450 },
      ],
    });
  });

  it('rejects a ballot over the voter budget and writes no submission', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      voterBudget: 700,
      pricedFields: ['budget'],
      proposalCount: 2,
      proposalPrices: [
        { budget: { amount: 300, currency: 'USD' } },
        { budget: { amount: 450, currency: 'USD' } },
      ],
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.submitVote({
        processInstanceId: instance.instance.id,
        selectedProposalIds: proposals.map((p) => p.id),
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });

    const submissions = await db.query.decisionsVoteSubmissions.findMany({
      where: { processInstanceId: instance.instance.id },
    });

    expect(submissions).toHaveLength(0);
  });

  it('charges nothing for a proposal with no budget', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      voterBudget: 300,
      pricedFields: ['budget'],
      proposalCount: 2,
      proposalPrices: [{ budget: { amount: 300, currency: 'USD' } }],
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: proposals.map((p) => p.id),
    });

    expect(await getVoteData(result.id)).toMatchObject({
      totalCost: 300,
      selections: [
        { proposalId: proposals[0]!.id, cost: 300 },
        { proposalId: proposals[1]!.id, cost: null },
      ],
    });
  });

  it('charges nothing for a budget stored in another currency', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      voterBudget: 300,
      pricedFields: ['budget'],
      proposalCount: 2,
      proposalPrices: [
        { budget: { amount: 300, currency: 'USD' } },
        { budget: { amount: 9000, currency: 'EUR' } },
      ],
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: proposals.map((p) => p.id),
    });

    expect(await getVoteData(result.id)).toMatchObject({ totalCost: 300 });
  });

  it('charges from the cost field the rules name', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      voterBudget: 10,
      voterCostField: 'cost',
      pricedFields: ['cost'],
      proposalCount: 2,
      proposalPrices: [{ cost: 7 }, { cost: 5 }],
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.submitVote({
        processInstanceId: instance.instance.id,
        selectedProposalIds: proposals.map((p) => p.id),
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });

    const result = await caller.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: [proposals[0]!.id],
    });

    expect(await getVoteData(result.id)).toMatchObject({
      voterCostField: 'cost',
      costUnit: DOTS,
      totalCost: 7,
    });
  });

  it('leaves the money budget out of a dot-costed ballot', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      voterBudget: 3,
      voterCostField: 'cost',
      pricedFields: ['budget', 'cost'],
      proposalCount: 3,
      proposalPrices: [
        { budget: { amount: 900, currency: 'USD' }, cost: 1 },
        { budget: { amount: 900, currency: 'USD' }, cost: 1 },
        { budget: { amount: 900, currency: 'USD' }, cost: 1 },
      ],
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: proposals.map((p) => p.id),
    });

    expect(await getVoteData(result.id)).toMatchObject({
      voterCostField: 'cost',
      costUnit: DOTS,
      totalCost: 3,
    });
  });

  it('rejects every ballot when the rules name a field the template does not price', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      voterBudget: 10,
      voterCostField: 'cost',
      pricedFields: ['budget'],
      proposalCount: 1,
      proposalPrices: [{ budget: { amount: 1, currency: 'USD' } }],
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.submitVote({
        processInstanceId: instance.instance.id,
        selectedProposalIds: [proposals[0]!.id],
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });

  it('applies the count cap and the budget cap independently', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      maxVotesPerMember: 2,
      voterBudget: 800,
      pricedFields: ['budget'],
      proposalCount: 3,
      proposalPrices: [
        { budget: { amount: 300, currency: 'USD' } },
        { budget: { amount: 450, currency: 'USD' } },
        { budget: { amount: 900, currency: 'USD' } },
      ],
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Within budget, over the count cap.
    await expect(
      caller.decision.submitVote({
        processInstanceId: instance.instance.id,
        selectedProposalIds: proposals.map((p) => p.id),
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });

    // Within the count cap, over budget.
    await expect(
      caller.decision.submitVote({
        processInstanceId: instance.instance.id,
        selectedProposalIds: [proposals[0]!.id, proposals[2]!.id],
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });

    const result = await caller.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: [proposals[0]!.id, proposals[1]!.id],
    });

    expect(result.selectedProposalIds).toHaveLength(2);
  });

  it('charges the document fragment’s budget, not the stale snapshot', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      voterBudget: 500,
      pricedFields: ['budget'],
      proposalCount: 1,
      proposalPrices: [{ budget: { amount: 100, currency: 'USD' } }],
    });

    const proposal = proposals[0]!;
    const { collaborationDocId } = proposal.proposalData as {
      collaborationDocId?: string;
    };

    mockCollab.setDocFragments(collaborationDocId!, {
      title: 'Proposal 1',
      budget: JSON.stringify({ amount: 900, currency: 'USD' }),
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.submitVote({
        processInstanceId: instance.instance.id,
        selectedProposalIds: [proposal.id],
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });

  it('leaves the budget keys off a submission with no cap', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      pricedFields: ['budget'],
      proposalCount: 1,
      proposalPrices: [{ budget: { amount: 300, currency: 'USD' } }],
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: [proposals[0]!.id],
    });

    const voteData = await getVoteData(result.id);

    expect(voteData?.voterBudget).toBeUndefined();
    expect(voteData?.voterCostField).toBeUndefined();
    expect(voteData?.costUnit).toBeUndefined();
    expect(voteData?.totalCost).toBeUndefined();
    expect(voteData?.selections).toEqual([
      { proposalId: proposals[0]!.id, cost: null },
    ]);
  });
});

describe.concurrent('submitVote ranked ballots', () => {
  async function getSelections(voteSubmissionId: string) {
    return db.query.decisionsVoteProposals.findMany({
      where: { voteSubmissionId },
      orderBy: { rank: 'asc', createdAt: 'asc' },
    });
  }

  it('persists the submission order as a rank', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      ranked: true,
      proposalCount: 3,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const ballot = [proposals[2]!.id, proposals[0]!.id, proposals[1]!.id];

    const result = await caller.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: ballot,
    });

    expect(await getSelections(result.id)).toMatchObject([
      { proposalId: ballot[0], rank: 1 },
      { proposalId: ballot[1], rank: 2 },
      { proposalId: ballot[2], rank: 3 },
    ]);
  });

  it('reads a ranked ballot back in the order it was cast', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      ranked: true,
      proposalCount: 3,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const ballot = [proposals[2]!.id, proposals[0]!.id, proposals[1]!.id];

    await caller.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: ballot,
    });

    const status = await caller.decision.getVotingStatus({
      processInstanceId: instance.instance.id,
    });

    expect(status.votingConfiguration.ranked).toBe(true);
    expect(status.selectedProposals?.map((p) => p.id)).toEqual(ballot);
  });

  it('leaves rank null on an unranked phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      proposalCount: 2,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: proposals.map((p) => p.id),
    });

    const selections = await getSelections(result.id);

    expect(selections).toHaveLength(2);
    expect(selections.every((s) => s.rank === null)).toBe(true);
  });

  it('records the rank alongside the cost in the ballot snapshot', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      ranked: true,
      voterBudget: 1000,
      pricedFields: ['budget'],
      proposalCount: 2,
      proposalPrices: [
        { budget: { amount: 300, currency: 'USD' } },
        { budget: { amount: 450, currency: 'USD' } },
      ],
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const ballot = [proposals[1]!.id, proposals[0]!.id];

    const result = await caller.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: ballot,
    });

    const row = await db.query.decisionsVoteSubmissions.findFirst({
      where: { id: result.id },
    });

    expect(row?.voteData.selections).toEqual([
      { proposalId: ballot[0], cost: 450, rank: 1 },
      { proposalId: ballot[1], cost: 300, rank: 2 },
    ]);
  });

  it('still rejects duplicate selections on a ranked ballot', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      ranked: true,
      proposalCount: 2,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.submitVote({
        processInstanceId: instance.instance.id,
        selectedProposalIds: [proposals[0]!.id, proposals[0]!.id],
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });

  it('writes nothing when a ranked ballot overruns the voter budget', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      ranked: true,
      voterBudget: 700,
      pricedFields: ['budget'],
      proposalCount: 2,
      proposalPrices: [
        { budget: { amount: 300, currency: 'USD' } },
        { budget: { amount: 450, currency: 'USD' } },
      ],
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.submitVote({
        processInstanceId: instance.instance.id,
        selectedProposalIds: proposals.map((p) => p.id),
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });

    const submissions = await db.query.decisionsVoteSubmissions.findMany({
      where: { processInstanceId: instance.instance.id },
    });

    expect(submissions).toHaveLength(0);
  });
});

describe.concurrent('getVotingStatus', () => {
  it('echoes the voter budget, its cost field and its unit', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await setupVotingInstance(testData, {
      voterBudget: 5000,
      voterCostField: 'cost',
      pricedFields: ['cost'],
      proposalCount: 0,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const status = await caller.decision.getVotingStatus({
      processInstanceId: instance.instance.id,
    });

    expect(status.votingConfiguration).toMatchObject({
      voterBudget: 5000,
      voterCostField: 'cost',
      costUnit: DOTS,
    });
  });

  it('reports no cost field when the phase sets no voter budget', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await setupVotingInstance(testData, {
      pricedFields: ['budget'],
      proposalCount: 0,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const status = await caller.decision.getVotingStatus({
      processInstanceId: instance.instance.id,
    });

    expect(status.votingConfiguration.voterBudget).toBeUndefined();
    expect(status.votingConfiguration.voterCostField).toBeUndefined();
    expect(status.votingConfiguration.costUnit).toBeUndefined();
  });

  it('returns undefined maxVotesPerMember when phase has no cap', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await setupVotingInstance(testData, {
      maxVotesPerMember: undefined,
      proposalCount: 0,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const status = await caller.decision.getVotingStatus({
      processInstanceId: instance.instance.id,
    });

    expect(status.votingConfiguration.maxVotesPerMember).toBeUndefined();
  });

  it('returns the phase cap when set', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await setupVotingInstance(testData, {
      maxVotesPerMember: 3,
      proposalCount: 0,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const status = await caller.decision.getVotingStatus({
      processInstanceId: instance.instance.id,
    });

    expect(status.votingConfiguration.maxVotesPerMember).toBe(3);
  });
});

describeDecisionAccessTierGating('submitVote', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const { instance, proposals } = await setupVotingInstance(testData, {
        proposalCount: 1,
      });

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.submitVote({
          processInstanceId: instance.instance.id,
          selectedProposalIds: [proposals[0]!.id],
        }),
        'none',
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'rejects anon-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const { instance, proposals } = await setupVotingInstance(testData, {
        proposalCount: 1,
      });

      const caller = await callers.anonJwt();

      await expectFailsAccessTierGate(
        caller.decision.submitVote({
          processInstanceId: instance.instance.id,
          selectedProposalIds: [proposals[0]!.id],
        }),
        'anon',
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'rejects user-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const { instance, proposals } = await setupVotingInstance(testData, {
        proposalCount: 1,
      });

      const caller = await callers.userJwt();

      await expectFailsAccessTierGate(
        caller.decision.submitVote({
          processInstanceId: instance.instance.id,
          selectedProposalIds: [proposals[0]!.id],
        }),
        'user',
      );
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const { setup, instance, proposals } = await setupVotingInstance(
        testData,
        {
          proposalCount: 1,
        },
      );

      const caller = await callers.networkJwt(setup.userEmail);

      const result = await caller.decision.submitVote({
        processInstanceId: instance.instance.id,
        selectedProposalIds: [proposals[0]!.id],
      });

      expect(result.selectedProposalIds).toEqual([proposals[0]!.id]);
    },
  ),
});

describeDecisionAccessTierGating('getVotingStatus', {
  noJwtNonPublic: accessTierGatingCell(
    'admits no-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const { instance } = await setupVotingInstance(testData, {
        proposalCount: 0,
      });

      const caller = await callers.noJwt();

      await expectPassesAccessTierGate(
        caller.decision.getVotingStatus({
          processInstanceId: instance.instance.id,
        }),
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'admits anon-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const { instance } = await setupVotingInstance(testData, {
        proposalCount: 0,
      });

      const caller = await callers.anonJwt();

      await expectPassesAccessTierGate(
        caller.decision.getVotingStatus({
          processInstanceId: instance.instance.id,
        }),
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'admits user-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const { instance } = await setupVotingInstance(testData, {
        proposalCount: 0,
      });

      const caller = await callers.userJwt();

      await expectPassesAccessTierGate(
        caller.decision.getVotingStatus({
          processInstanceId: instance.instance.id,
        }),
      );
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const { setup, instance } = await setupVotingInstance(testData, {
        proposalCount: 0,
      });

      const caller = await callers.networkJwt(setup.userEmail);

      const status = await caller.decision.getVotingStatus({
        processInstanceId: instance.instance.id,
      });

      expect(status.votingConfiguration).toBeDefined();
    },
  ),
});
