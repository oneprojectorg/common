import { mockCollab } from '@op/collab/testing';
import {
  type DecisionInstanceData,
  advancePhase,
  parseProposalData,
} from '@op/common';
import {
  TestDecisionsDataManager,
  schemaMissingPipeline,
  schemaWithPipeline,
  schemaWithRankedBudgetPipeline,
  schemaWithThreePhasesAndPipelines,
} from '@op/common/testing';
import { and, db, eq } from '@op/db/client';
import {
  ProcessStatus,
  ProposalStatus,
  decisionTransitionProposals,
  processInstances,
  stateTransitionHistory,
} from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

interface LoadedInstance {
  setup: Awaited<ReturnType<TestDecisionsDataManager['createDecisionSetup']>>;
  dbInstance: NonNullable<
    Awaited<ReturnType<typeof db.query.processInstances.findFirst>>
  >;
}

/** Loads a published instance from the DB. */
async function loadPublishedInstance(
  testData: TestDecisionsDataManager,
): Promise<LoadedInstance> {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
    status: ProcessStatus.PUBLISHED,
  });

  return {
    setup,
    dbInstance: await reloadInstance(setup.instance.instance.id),
  };
}

/** Reloads the instance row, e.g. after writes outside advancePhase. */
async function reloadInstance(
  instanceId: string,
): Promise<LoadedInstance['dbInstance']> {
  const dbInstance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
  });

  if (!dbInstance) {
    throw new Error('Failed to reload instance');
  }

  return dbInstance;
}

/** Calls advancePhase with the loaded instance and given override fields. */
async function callAdvancePhase(
  loaded: LoadedInstance,
  overrides: Partial<Parameters<typeof advancePhase>[0]> & {
    fromPhaseId: string;
    toPhaseId: string;
  },
) {
  const { dbInstance } = loaded;
  return db.transaction(async (tx) =>
    advancePhase({
      db: tx,
      instance: {
        id: dbInstance.id,
        instanceData: dbInstance.instanceData as DecisionInstanceData,
      },
      triggeredByProfileId: null,
      ...overrides,
    }),
  );
}

describe.concurrent('advancePhase', () => {
  it('advances initial → final and writes history', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const loaded = await loadPublishedInstance(testData);

    const result = await callAdvancePhase(loaded, {
      fromPhaseId: 'initial',
      toPhaseId: 'final',
    });

    expect(result.conflict).toBe(false);
    if (result.conflict) throw new Error('unreachable');
    expect(result.transitionHistoryId).toBeDefined();

    const reloaded = await db.query.processInstances.findFirst({
      where: { id: loaded.dbInstance.id },
    });
    expect(reloaded!.currentStateId).toBe('final');

    expect(reloaded!.currentStateId).toBe('final');

    const history = await db.query.stateTransitionHistory.findFirst({
      where: { processInstanceId: loaded.dbInstance.id },
    });
    expect(history).toBeDefined();
    expect(history!.fromStateId).toBe('initial');
    expect(history!.toStateId).toBe('final');
    expect(history!.triggeredByProfileId).toBeNull();
  });

  it('returns conflict when fromPhaseId does not match current state', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const loaded = await loadPublishedInstance(testData);

    const result = await callAdvancePhase(loaded, {
      fromPhaseId: 'final',
      toPhaseId: 'initial',
    });

    expect(result.conflict).toBe(true);

    const reloaded = await db.query.processInstances.findFirst({
      where: { id: loaded.dbInstance.id },
    });
    expect(reloaded!.currentStateId).toBe('initial');
  });

  it('returns conflict when instance is not PUBLISHED', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const loaded = await loadPublishedInstance(testData);

    // Demote the instance back to DRAFT — caller's snapshot is now stale
    await db
      .update(processInstances)
      .set({ status: ProcessStatus.DRAFT })
      .where(eq(processInstances.id, loaded.dbInstance.id));

    const result = await callAdvancePhase(loaded, {
      fromPhaseId: 'initial',
      toPhaseId: 'final',
    });

    expect(result.conflict).toBe(true);

    const reloaded = await db.query.processInstances.findFirst({
      where: { id: loaded.dbInstance.id },
    });
    expect(reloaded!.currentStateId).toBe('initial');
  });

  it('stores transitionData on the history row', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const loaded = await loadPublishedInstance(testData);

    await callAdvancePhase(loaded, {
      fromPhaseId: 'initial',
      toPhaseId: 'final',
      transitionData: { source: 'cron', batch: 42 },
    });

    const history = await db.query.stateTransitionHistory.findFirst({
      where: { processInstanceId: loaded.dbInstance.id },
    });
    expect(history!.transitionData).toEqual({
      source: 'cron',
      batch: 42,
      selection: { outcomes: [] },
    });
  });

  it('persists submitted proposals into decisionTransitionProposals', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;

    // Create + submit a proposal so it has a proposalHistory row
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Proposal A' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);
    await caller.decision.submitProposal({ proposalId: proposal.id });

    await db
      .update(processInstances)
      .set({ status: ProcessStatus.PUBLISHED })
      .where(eq(processInstances.id, instance.instance.id));

    const dbInstance = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
    });
    if (!dbInstance) {
      throw new Error('Failed to reload instance');
    }

    const result = await callAdvancePhase(
      { setup, dbInstance },
      { fromPhaseId: 'initial', toPhaseId: 'final' },
    );

    expect(result.conflict).toBe(false);
    if (result.conflict) throw new Error('unreachable');
    expect(result.selectedProposalIds).toContain(proposal.id);

    const joinRows = await db
      .select()
      .from(decisionTransitionProposals)
      .where(eq(decisionTransitionProposals.processInstanceId, dbInstance.id));
    expect(joinRows.length).toBe(1);
    expect(joinRows[0]!.proposalId).toBe(proposal.id);
    expect(joinRows[0]!.transitionHistoryId).toBe(result.transitionHistoryId);
  });

  it('does not write join rows when there are no selected proposals', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const loaded = await loadPublishedInstance(testData);

    const result = await callAdvancePhase(loaded, {
      fromPhaseId: 'initial',
      toPhaseId: 'final',
    });

    expect(result.conflict).toBe(false);
    if (result.conflict) throw new Error('unreachable');
    expect(result.selectedProposalIds).toEqual([]);

    const joinRows = await db
      .select()
      .from(decisionTransitionProposals)
      .where(
        eq(decisionTransitionProposals.processInstanceId, loaded.dbInstance.id),
      );
    expect(joinRows.length).toBe(0);
  });

  it('selects by ranked-choice points and skips what the phase budget cannot cover', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, a, b, c, d } = await seedRankedBudgetVoting(
      testData,
      task.id,
    );
    await setPhaseBudgets(setup, instanceId, { submission: 1, voting: 1000 });

    const result = await callAdvancePhase(
      { setup, dbInstance: await reloadInstance(instanceId) },
      { fromPhaseId: 'voting', toPhaseId: 'results' },
    );

    expect(result.conflict).toBe(false);
    if (result.conflict) {
      throw new Error('unreachable');
    }
    // a (400) and b (500) fit; d (300) exceeds the 100 left and is skipped; c (100) fits.
    expect(result.selectedProposalIds).toEqual([a.id, b.id, c.id]);

    const [transition] = await db
      .select({ transitionData: stateTransitionHistory.transitionData })
      .from(stateTransitionHistory)
      .where(eq(stateTransitionHistory.id, result.transitionHistoryId));
    expect(transition?.transitionData).toEqual({
      selection: {
        outcomes: [
          {
            proposalId: a.id,
            outcome: 'selected',
            scores: {
              rankPoints: 10,
              position: 1,
              cost: 400,
              budgetRemaining: 1000,
            },
          },
          {
            proposalId: b.id,
            outcome: 'selected',
            scores: {
              rankPoints: 8,
              position: 2,
              cost: 500,
              budgetRemaining: 600,
            },
          },
          {
            proposalId: c.id,
            outcome: 'selected',
            scores: {
              rankPoints: 3,
              position: 4,
              cost: 100,
              budgetRemaining: 100,
            },
          },
          {
            proposalId: d.id,
            outcome: 'skipped',
            scores: {
              rankPoints: 5,
              position: 3,
              cost: 300,
              budgetRemaining: 100,
            },
          },
        ],
      },
    });
  });

  it('fails the transition when the departing phase has no budget setting', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await seedRankedBudgetVoting(
      testData,
      task.id,
    );
    await setPhaseBudgets(setup, instanceId, { submission: 1 });

    await expect(
      callAdvancePhase(
        { setup, dbInstance: await reloadInstance(instanceId) },
        { fromPhaseId: 'voting', toPhaseId: 'results' },
      ),
    ).rejects.toThrow(/budget/);

    const untouched = await reloadInstance(instanceId);
    expect(untouched.currentStateId).toBe('voting');
    const [history] = await db
      .select({ id: stateTransitionHistory.id })
      .from(stateTransitionHistory)
      .where(
        and(
          eq(stateTransitionHistory.processInstanceId, instanceId),
          eq(stateTransitionHistory.fromStateId, 'voting'),
        ),
      );
    expect(history).toBeUndefined();
  });

  it('records proposals a limit dropped as excluded', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      status: ProcessStatus.PUBLISHED,
      processSchema: schemaWithPipeline,
    });
    const instanceId = setup.instance.instance.id;
    await Promise.all(
      ['newest', 'older', 'oldest'].map((key) =>
        testData.createProposal({
          userEmail: setup.userEmail,
          processInstanceId: instanceId,
          proposalData: { title: `Proposal ${key} ${task.id}` },
          status: ProposalStatus.SUBMITTED,
        }),
      ),
    );

    const result = await callAdvancePhase(
      { setup, dbInstance: await reloadInstance(instanceId) },
      { fromPhaseId: 'submission', toPhaseId: 'review' },
    );

    expect(result.conflict).toBe(false);
    if (result.conflict) {
      throw new Error('unreachable');
    }
    expect(result.selectedProposalIds).toHaveLength(2);
    const [transition] = await db
      .select({ transitionData: stateTransitionHistory.transitionData })
      .from(stateTransitionHistory)
      .where(eq(stateTransitionHistory.id, result.transitionHistoryId));
    expect(transition?.transitionData).toMatchObject({
      selection: {
        outcomes: [
          { outcome: 'selected' },
          { outcome: 'selected' },
          { outcome: 'excluded', scores: {} },
        ],
      },
    });
  });

  it('holds the selection for approval, preselects it, and attaches on confirmation', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      status: ProcessStatus.PUBLISHED,
      processSchema: schemaWithPipeline,
    });
    const instanceId = setup.instance.instance.id;
    await Promise.all(
      ['first', 'second', 'third'].map((key) =>
        testData.createProposal({
          userEmail: setup.userEmail,
          processInstanceId: instanceId,
          proposalData: { title: `Proposal ${key} ${task.id}` },
          status: ProposalStatus.SUBMITTED,
        }),
      ),
    );
    const { instanceData } = setup.instance.instance;
    await db
      .update(processInstances)
      .set({
        instanceData: {
          ...instanceData,
          phases: instanceData.phases.map((phase) =>
            phase.phaseId === 'submission'
              ? { ...phase, selectionNeedsApproval: true }
              : phase,
          ),
        },
      })
      .where(eq(processInstances.id, instanceId));

    const result = await callAdvancePhase(
      { setup, dbInstance: await reloadInstance(instanceId) },
      { fromPhaseId: 'submission', toPhaseId: 'review' },
    );

    expect(result.conflict).toBe(false);
    if (result.conflict) {
      throw new Error('unreachable');
    }
    expect(result.selectedProposalIds).toEqual([]);
    const attachedBefore = await db
      .select({ proposalId: decisionTransitionProposals.proposalId })
      .from(decisionTransitionProposals)
      .where(
        eq(
          decisionTransitionProposals.transitionHistoryId,
          result.transitionHistoryId,
        ),
      );
    expect(attachedBefore).toEqual([]);

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const candidates = await caller.decision.listSelectionCandidates({
      processInstanceId: instanceId,
    });
    expect(candidates.outcomes.map(({ outcome }) => outcome)).toEqual([
      'selected',
      'selected',
      'excluded',
    ]);
    const preselected = candidates.outcomes
      .filter(({ outcome }) => outcome === 'selected')
      .map(({ proposalId }) => proposalId);

    await caller.decision.submitManualSelection({
      processInstanceId: instanceId,
      proposalIds: preselected,
    });

    const attachedAfter = await db
      .select({ proposalId: decisionTransitionProposals.proposalId })
      .from(decisionTransitionProposals)
      .where(
        eq(
          decisionTransitionProposals.transitionHistoryId,
          result.transitionHistoryId,
        ),
      );
    expect(attachedAfter.map(({ proposalId }) => proposalId).sort()).toEqual(
      [...preselected].sort(),
    );
  });

  it('writes no selection audit when the departing phase has no pipeline', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      status: ProcessStatus.PUBLISHED,
      processSchema: schemaMissingPipeline,
    });
    const instanceId = setup.instance.instance.id;

    const result = await callAdvancePhase(
      { setup, dbInstance: await reloadInstance(instanceId) },
      { fromPhaseId: 'submission', toPhaseId: 'review' },
    );

    expect(result.conflict).toBe(false);
    if (result.conflict) {
      throw new Error('unreachable');
    }
    const [transition] = await db
      .select({ transitionData: stateTransitionHistory.transitionData })
      .from(stateTransitionHistory)
      .where(eq(stateTransitionHistory.id, result.transitionHistoryId));
    expect(transition?.transitionData).toEqual({});
  });

  it('refuses to advance a phase whose inbound selection still awaits approval', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      status: ProcessStatus.PUBLISHED,
      processSchema: schemaWithThreePhasesAndPipelines,
    });
    const instanceId = setup.instance.instance.id;
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Held ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });
    const { instanceData } = setup.instance.instance;
    await db
      .update(processInstances)
      .set({
        instanceData: {
          ...instanceData,
          phases: instanceData.phases.map((phase) =>
            phase.phaseId === 'submission'
              ? { ...phase, selectionNeedsApproval: true }
              : phase,
          ),
        },
      })
      .where(eq(processInstances.id, instanceId));
    const reload = async () => {
      const row = await db.query.processInstances.findFirst({
        where: { id: instanceId },
      });
      if (!row) {
        throw new Error('Failed to reload instance');
      }
      return row;
    };

    const held = await callAdvancePhase(
      { setup, dbInstance: await reload() },
      { fromPhaseId: 'submission', toPhaseId: 'review' },
    );
    expect(held.conflict).toBe(false);

    await expect(
      callAdvancePhase(
        { setup, dbInstance: await reload() },
        { fromPhaseId: 'review', toPhaseId: 'final' },
      ),
    ).rejects.toThrow(/awaits approval/);

    const caller = await createAuthenticatedCaller(setup.userEmail);
    await caller.decision.submitManualSelection({
      processInstanceId: instanceId,
      proposalIds: [proposal.id],
    });

    const advanced = await callAdvancePhase(
      { setup, dbInstance: await reload() },
      { fromPhaseId: 'review', toPhaseId: 'final' },
    );
    expect(advanced.conflict).toBe(false);
  });

  it('holds the selection for the admin when the departing phase needs approval', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      status: ProcessStatus.PUBLISHED,
      processSchema: schemaWithPipeline,
    });
    const instanceId = setup.instance.instance.id;
    const createSubmitted = (key: string) =>
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Proposal ${key} ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      });
    const [first] = await Promise.all([
      createSubmitted('first'),
      createSubmitted('second'),
      createSubmitted('third'),
    ]);
    const { instanceData } = setup.instance.instance;
    await db
      .update(processInstances)
      .set({
        instanceData: {
          ...instanceData,
          phases: instanceData.phases.map((phase) =>
            phase.phaseId === 'submission'
              ? { ...phase, selectionNeedsApproval: true }
              : phase,
          ),
        },
      })
      .where(eq(processInstances.id, instanceId));
    const dbInstance = await db.query.processInstances.findFirst({
      where: { id: instanceId },
    });
    if (!dbInstance) {
      throw new Error('Failed to reload instance');
    }

    const result = await callAdvancePhase(
      { setup, dbInstance },
      { fromPhaseId: 'submission', toPhaseId: 'review' },
    );

    expect(result.conflict).toBe(false);
    if (result.conflict) {
      throw new Error('unreachable');
    }
    // The limit(2) pipeline chose two, but the admin has the last word.
    expect(result.selectedProposalIds).toEqual([]);
    const attachedBefore = await db
      .select({ proposalId: decisionTransitionProposals.proposalId })
      .from(decisionTransitionProposals)
      .where(
        eq(
          decisionTransitionProposals.transitionHistoryId,
          result.transitionHistoryId,
        ),
      );
    expect(attachedBefore).toEqual([]);

    const caller = await createAuthenticatedCaller(setup.userEmail);
    await caller.decision.submitManualSelection({
      processInstanceId: instanceId,
      proposalIds: [first.id],
    });

    const attachedAfter = await db
      .select({ proposalId: decisionTransitionProposals.proposalId })
      .from(decisionTransitionProposals)
      .where(
        eq(
          decisionTransitionProposals.transitionHistoryId,
          result.transitionHistoryId,
        ),
      );
    expect(attachedAfter.map(({ proposalId }) => proposalId)).toEqual([
      first.id,
    ]);
  });
});

/**
 * A published ranked-budget instance in its voting phase with four priced
 * proposals (a 400, b 500, c 100, d 300) and two ballots: [a, b, c, d] and
 * [a, b, d], so the points are a 10, b 8, d 5, c 3.
 */
async function seedRankedBudgetVoting(
  testData: TestDecisionsDataManager,
  taskId: string,
) {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
    status: ProcessStatus.PUBLISHED,
    processSchema: schemaWithRankedBudgetPipeline,
  });
  const instanceId = setup.instance.instance.id;

  const createCostedProposal = async (key: string, amount: number) => {
    const budget = { amount, currency: 'USD' };
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Proposal ${key} ${taskId}`, budget },
      status: ProposalStatus.SUBMITTED,
    });
    const { collaborationDocId } = parseProposalData(proposal.proposalData);
    if (!collaborationDocId) {
      throw new Error(`Proposal ${key} has no collaboration document`);
    }
    // Costs are priced from the live document, so it must carry the budget.
    mockCollab.setDocFragments(collaborationDocId, {
      title: `Proposal ${key} ${taskId}`,
      budget: JSON.stringify(budget),
    });
    return proposal;
  };
  const [a, b, c, d] = await Promise.all([
    createCostedProposal('a', 400),
    createCostedProposal('b', 500),
    createCostedProposal('c', 100),
    createCostedProposal('d', 300),
  ]);

  const toVoting = await callAdvancePhase(
    { setup, dbInstance: await reloadInstance(instanceId) },
    { fromPhaseId: 'submission', toPhaseId: 'voting' },
  );
  expect(toVoting.conflict).toBe(false);

  const member = await testData.createMemberUser({
    organization: setup.organization,
    instanceProfileIds: [setup.instance.profileId],
  });
  const [ownerCaller, memberCaller] = await Promise.all([
    createAuthenticatedCaller(setup.userEmail),
    createAuthenticatedCaller(member.email),
  ]);
  await ownerCaller.decision.submitVote({
    processInstanceId: instanceId,
    selectedProposalIds: [a.id, b.id, c.id, d.id],
  });
  await memberCaller.decision.submitVote({
    processInstanceId: instanceId,
    selectedProposalIds: [a.id, b.id, d.id],
  });

  return { setup, instanceId, a, b, c, d };
}

/** Writes a `budget` setting on each named phase of the instance. */
async function setPhaseBudgets(
  setup: LoadedInstance['setup'],
  instanceId: string,
  budgets: Record<string, number>,
) {
  const { instanceData } = setup.instance.instance;
  await db
    .update(processInstances)
    .set({
      instanceData: {
        ...instanceData,
        phases: instanceData.phases.map((phase) =>
          phase.phaseId in budgets
            ? { ...phase, settings: { budget: budgets[phase.phaseId] } }
            : phase,
        ),
      },
    })
    .where(eq(processInstances.id, instanceId));
}
