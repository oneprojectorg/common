import { mockCollab } from '@op/collab/testing';
import { affirmVoterAttestation, resolveVoterAddress } from '@op/common';
import type { BudgetData, VoterEnrolmentRule } from '@op/common/client';
import { TestDecisionsDataManager } from '@op/common/testing';
import {
  createDecisionBoundary,
  ensureProposalCategoryTerms,
} from '@op/common/testing/data';
import { ProposalStatus, processInstances, taxonomyTerms } from '@op/db/schema';
import { db, eq, inArray } from '@op/db/test';
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
  enrolment?: VoterEnrolmentRule;
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
  enrolment,
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
            ...(enrolment !== undefined && { enrolment }),
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
    /** Per-proposal pin, so the boundary tags the proposal with its district. */
    proposalLocations?: Array<{ lat: number; lng: number } | undefined>;
    /** Runs after the decision exists and before its proposals, e.g. to import boundaries. */
    beforeProposals?: (setup: {
      instance: { instance: { id: string; profileId: string | null } };
    }) => Promise<void>;
  },
) {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
    processSchema: buildVotingSchema(opts),
  });

  const instance = setup.instance;
  await opts.beforeProposals?.(setup);

  const proposals = await Promise.all(
    Array.from({ length: opts.proposalCount }, (_, i) =>
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: {
          title: `Proposal ${i + 1}`,
          ...opts.proposalPrices?.[i],
          ...(opts.proposalLocations?.[i]
            ? { location: opts.proposalLocations[i] }
            : {}),
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

  it('keeps a ballot marked ranked after the phase moves on', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      ranked: true,
      proposalCount: 2,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const ballot = [proposals[1]!.id, proposals[0]!.id];

    const result = await caller.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: ballot,
    });
    expect(result.ranked).toBe(true);

    await db
      .update(processInstances)
      .set({ currentStateId: 'results' })
      .where(eq(processInstances.id, instance.instance.id));

    const status = await caller.decision.getVotingStatus({
      processInstanceId: instance.instance.id,
    });

    expect(status.votingConfiguration.ranked).toBe(false);
    expect(status.voteSubmission?.ranked).toBe(true);
    expect(status.voteSubmission?.selectedProposalIds).toEqual(ballot);
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
    expect(result.ranked).toBe(false);

    const status = await caller.decision.getVotingStatus({
      processInstanceId: instance.instance.id,
    });
    expect(status.voteSubmission?.ranked).toBe(false);
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

describe.concurrent('submitVote with an enrolment rule', () => {
  const ATTESTATION = 'I affirm that I meet the eligibility requirements.';

  it('given the voting phase requires enrolment, when a member who has not enrolled votes, then the vote is refused as not enrolled and no submission is written', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      proposalCount: 1,
      enrolment: { attestation: ATTESTATION },
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.submitVote({
        processInstanceId: instance.instance.id,
        selectedProposalIds: proposals.map((p) => p.id),
      }),
    ).rejects.toMatchObject({ cause: { name: 'VoterNotEnrolledError' } });

    await expect(
      db.query.decisionsVoteSubmissions.findFirst({
        where: { processInstanceId: instance.instance.id },
      }),
    ).resolves.toBeUndefined();
  });

  it('given a member enrolled before an admin rewrites the attestation, when they vote, then the vote is accepted because enrolment records only the time', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      proposalCount: 1,
      enrolment: { attestation: ATTESTATION },
    });
    const key = {
      processInstanceId: instance.instance.id,
      authUserId: setup.user.id,
    };
    await resolveVoterAddress({
      ...key,
      address: 'anywhere',
      geocode: async () => [{ lat: 40.5, lng: -73.5 }],
    });
    await affirmVoterAttestation(key);
    const caller = await createAuthenticatedCaller(setup.userEmail);
    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      phases: [
        {
          phaseId: 'voting',
          rules: {
            voting: {
              submit: true,
              enrolment: {
                attestation: `I affirm the rewritten requirements ${task.id}.`,
              },
            },
          },
        },
      ],
    });

    const result = await caller.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: proposals.map((p) => p.id),
    });

    await expect(
      db.query.decisionsVoteSubmissions.findFirst({
        where: { id: result.id },
        columns: { id: true },
      }),
    ).resolves.toEqual({ id: result.id });
  });

  it('given the voting phase requires enrolment, when an enrolled member votes, then the submission is written', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      proposalCount: 1,
      enrolment: { attestation: ATTESTATION },
    });
    const key = {
      processInstanceId: instance.instance.id,
      authUserId: setup.user.id,
    };
    await resolveVoterAddress({
      ...key,
      address: 'anywhere',
      geocode: async () => [{ lat: 40.5, lng: -73.5 }],
    });
    await affirmVoterAttestation(key);
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: proposals.map((p) => p.id),
    });

    await expect(
      db.query.decisionsVoteSubmissions.findFirst({
        where: { id: result.id },
        columns: { id: true, processInstanceId: true },
      }),
    ).resolves.toEqual({
      id: result.id,
      processInstanceId: instance.instance.id,
    });
  });
});

describe.concurrent('submitVote scoped to the voter district', () => {
  const ATTESTATION = 'I affirm that I live in the city.';

  const enrolInDistrictFive = async (
    testData: TestDecisionsDataManager,
    label: string,
    onTestFinished: (fn: () => Promise<void>) => void,
  ) => {
    const five = `District 5 ${label}`;
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      proposalCount: 2,
      enrolment: { attestation: ATTESTATION, boundary: true },
      proposalLocations: [
        { lat: 40.5, lng: -73.5 },
        { lat: 10.5, lng: 10.5 },
      ],
      beforeProposals: async (created) => {
        const [termFive] = await ensureProposalCategoryTerms([five]);
        onTestFinished(async () => {
          await db
            .delete(taxonomyTerms)
            .where(inArray(taxonomyTerms.id, [termFive!.taxonomyTermId]));
        });
        await createDecisionBoundary({
          profileId: created.instance.instance.profileId!,
          name: five,
          taxonomyTermId: termFive!.taxonomyTermId,
        });
      },
    });
    const key = {
      processInstanceId: instance.instance.id,
      authUserId: setup.user.id,
    };
    await resolveVoterAddress({
      ...key,
      address: 'inside district five',
      geocode: async () => [{ lat: 40.5, lng: -73.5 }],
    });
    await affirmVoterAttestation({
      ...key,
      attestationHash: hashAttestation(ATTESTATION),
    });
    return { setup, instance, proposals };
  };

  it('given a District 5 voter picks a District 7 proposal, then the vote is refused as outside their district and nothing is written', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await enrolInDistrictFive(
      testData,
      task.id,
      onTestFinished,
    );
    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.submitVote({
        processInstanceId: instance.instance.id,
        selectedProposalIds: [proposals[1]!.id],
      }),
    ).rejects.toMatchObject({ cause: { name: 'VoteOutsideDistrictError' } });
    await expect(
      db.query.decisionsVoteSubmissions.findFirst({
        where: { processInstanceId: instance.instance.id },
      }),
    ).resolves.toBeUndefined();
  });

  it('given a District 5 voter picks a District 5 proposal, then the vote is written', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await enrolInDistrictFive(
      testData,
      task.id,
      onTestFinished,
    );
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: [proposals[0]!.id],
    });

    await expect(
      db.query.decisionsVoteSubmissions.findFirst({
        where: { id: result.id },
        columns: { id: true },
      }),
    ).resolves.toEqual({ id: result.id });
  });
});
