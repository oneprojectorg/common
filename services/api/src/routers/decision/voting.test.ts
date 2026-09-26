import { mockCollab } from '@op/collab/testing';
import type { AmountUnit, BudgetData } from '@op/common/client';
import { ProposalStatus, processInstances } from '@op/db/schema';
import { db, eq } from '@op/db/test';
import { describe, expect, it } from 'vitest';

import { appRouter } from '..';
import { TestDecisionsDataManager } from '../../test/helpers/TestDecisionsDataManager';
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

interface VotingSchemaOptions {
  maxVotesPerMember?: number;
  /** Knapsack cap on the voting phase, in `budgetUnit`. */
  voterBudget?: number;
  /** Persist the order of `selectedProposalIds` as a rank per selection. */
  ranked?: boolean;
  /**
   * Unit the proposal template's budget field declares. Omit to leave the
   * template without a budget field at all.
   */
  budgetUnit?: AmountUnit;
}

/** The proposal template a process counting in `unit` would carry. */
function buildProposalTemplate(unit: AmountUnit) {
  return {
    type: 'object',
    properties: {
      title: { type: 'string', title: 'Title', 'x-format': 'short-text' },
      budget: {
        type: 'object',
        title: 'Budget',
        'x-format': 'money',
        'x-unit': unit,
        properties: {
          amount: { type: 'number' },
          ...(unit.kind === 'currency'
            ? { currency: { type: 'string', default: unit.code } }
            : {}),
        },
      },
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
  ranked,
  budgetUnit,
}: VotingSchemaOptions = {}) {
  return {
    id: 'voting-test',
    version: '1.0.0',
    name: 'Voting Test Schema',
    description: 'Schema for voting integration tests',
    ...(budgetUnit && { proposalTemplate: buildProposalTemplate(budgetUnit) }),
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
    /**
     * Budget for the proposal at each index, so a test can price its pool.
     * A shorter array leaves the remaining proposals without a budget.
     */
    proposalBudgets?: Array<BudgetData | undefined>;
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
          ...(opts.proposalBudgets?.[i] && {
            budget: opts.proposalBudgets[i],
          }),
        },
        status: ProposalStatus.SUBMITTED,
      }),
    ),
  );

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
  const USD: AmountUnit = { kind: 'currency', code: 'USD' };
  const POINTS: AmountUnit = { kind: 'custom', label: 'points' };

  /** The ballot snapshot the submission stored. */
  async function readVoteData(voteSubmissionId: string) {
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
      budgetUnit: USD,
      proposalCount: 2,
      proposalBudgets: [{ amount: 300 }, { amount: 450 }],
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: proposals.map((p) => p.id),
    });

    expect(await readVoteData(result.id)).toMatchObject({
      voterBudget: 1000,
      budgetUnit: USD,
      totalCost: 750,
      selections: [
        { proposalId: proposals[0]!.id, cost: 300 },
        { proposalId: proposals[1]!.id, cost: 450 },
      ],
    });
  });

  it('accepts a ballot exactly at the voter budget', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      voterBudget: 750,
      budgetUnit: USD,
      proposalCount: 2,
      proposalBudgets: [{ amount: 300 }, { amount: 450 }],
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: proposals.map((p) => p.id),
    });

    expect(result.selectedProposalIds).toHaveLength(2);
  });

  it('rejects a ballot over the voter budget and writes no submission', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      voterBudget: 700,
      budgetUnit: USD,
      proposalCount: 2,
      proposalBudgets: [{ amount: 300 }, { amount: 450 }],
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

  // A misconfigured or unpriced proposal must stay votable rather than
  // silently disappear from the ballot.
  it('charges nothing for a proposal with no budget', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      voterBudget: 300,
      budgetUnit: USD,
      proposalCount: 2,
      proposalBudgets: [{ amount: 300 }],
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: proposals.map((p) => p.id),
    });

    expect(await readVoteData(result.id)).toMatchObject({
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
      budgetUnit: USD,
      proposalCount: 2,
      proposalBudgets: [{ amount: 300 }, { amount: 9000, currency: 'EUR' }],
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: proposals.map((p) => p.id),
    });

    expect(await readVoteData(result.id)).toMatchObject({ totalCost: 300 });
  });

  it('enforces the cap on a custom-unit template', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      voterBudget: 10,
      budgetUnit: POINTS,
      proposalCount: 2,
      proposalBudgets: [{ amount: 7 }, { amount: 5 }],
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

    expect(await readVoteData(result.id)).toMatchObject({
      budgetUnit: POINTS,
      totalCost: 7,
    });
  });

  // The two caps are independent: either can reject a ballot the other
  // would accept.
  it('applies the count cap and the budget cap independently', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      maxVotesPerMember: 2,
      voterBudget: 800,
      budgetUnit: USD,
      proposalCount: 3,
      proposalBudgets: [{ amount: 300 }, { amount: 450 }, { amount: 900 }],
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

  // A collaborative proposal keeps its live budget in the Yjs fragment, so a
  // budget raised after submission is the one a voter is charged.
  it('charges the document fragment’s budget, not the stale snapshot', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      voterBudget: 500,
      budgetUnit: USD,
      proposalCount: 1,
      proposalBudgets: [{ amount: 100 }],
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
      budgetUnit: USD,
      proposalCount: 1,
      proposalBudgets: [{ amount: 300 }],
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: [proposals[0]!.id],
    });

    const voteData = await readVoteData(result.id);

    expect(voteData?.voterBudget).toBeUndefined();
    expect(voteData?.budgetUnit).toBeUndefined();
    expect(voteData?.totalCost).toBeUndefined();
    expect(voteData?.selections).toEqual([
      { proposalId: proposals[0]!.id, cost: null },
    ]);
  });
});

describe.concurrent('submitVote ranked ballots', () => {
  /** The join rows a ballot wrote, as the database holds them. */
  async function readSelections(voteSubmissionId: string) {
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

    // Deliberately not the creation order — the ballot's order is the rank.
    const ballot = [proposals[2]!.id, proposals[0]!.id, proposals[1]!.id];

    const result = await caller.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: ballot,
    });

    expect(await readSelections(result.id)).toMatchObject([
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

    const selections = await readSelections(result.id);

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
      budgetUnit: { kind: 'currency', code: 'USD' },
      proposalCount: 2,
      proposalBudgets: [{ amount: 300 }, { amount: 450 }],
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

  // Budget validation runs first, so nothing is ranked on a ballot that was
  // never going to be accepted.
  it('writes nothing when a ranked ballot overruns the voter budget', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      ranked: true,
      voterBudget: 700,
      budgetUnit: { kind: 'currency', code: 'USD' },
      proposalCount: 2,
      proposalBudgets: [{ amount: 300 }, { amount: 450 }],
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
  it('echoes the voter budget and its unit', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await setupVotingInstance(testData, {
      voterBudget: 5000,
      budgetUnit: { kind: 'custom', label: 'points' },
      proposalCount: 0,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const status = await caller.decision.getVotingStatus({
      processInstanceId: instance.instance.id,
    });

    expect(status.votingConfiguration.voterBudget).toBe(5000);
    expect(status.votingConfiguration.budgetUnit).toEqual({
      kind: 'custom',
      label: 'points',
    });
  });

  it('reports no budget unit when the template collects no budget', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await setupVotingInstance(testData, {
      proposalCount: 0,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const status = await caller.decision.getVotingStatus({
      processInstanceId: instance.instance.id,
    });

    expect(status.votingConfiguration.voterBudget).toBeUndefined();
    expect(status.votingConfiguration.budgetUnit).toBeUndefined();
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
