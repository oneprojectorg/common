import {
  advancePhase,
  getProposalIdsForPhase,
  resolvePhases,
} from '@op/common';
import {
  TestDecisionsDataManager,
  schemaWithPipeline,
  schemaWithThreePhasesAndPipelines,
} from '@op/common/testing';
import { and, db, eq, sql } from '@op/db/client';
import {
  ProcessStatus,
  ProposalStatus,
  decisionTransitionProposals,
  processInstances,
  processPhases,
} from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { listPhaseIds } from '../../../test/helpers/phaseTestUtils';
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

  const instance = setup.instance;

  const dbInstance = await db.query.processInstances.findFirst({
    where: { id: instance.instance.id },
  });

  if (!dbInstance) {
    throw new Error('Failed to reload instance');
  }

  return { setup, dbInstance };
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
      instance: await resolvePhases({ instance: dbInstance }),
      triggeredByProfileId: null,
      ...overrides,
    }),
  );
}

// Phases resolve from their rows, so the flag goes on the row's data, under
// its advancement rule.
async function holdPhaseSelection(
  instanceId: string,
  phaseId: string,
): Promise<void> {
  const rules = sql`coalesce(${processPhases.data} -> 'rules', '{}'::jsonb)`;
  const advancement = sql`coalesce(${rules} -> 'advancement', '{"method":"manual"}'::jsonb) || '{"needsApproval":true}'::jsonb`;
  await db
    .update(processPhases)
    .set({
      data: sql`${processPhases.data} || jsonb_build_object('rules', ${rules} || jsonb_build_object('advancement', ${advancement}))`,
    })
    .where(
      and(
        eq(processPhases.processInstanceId, instanceId),
        sql`${processPhases.data} ->> 'phaseId' = ${phaseId}`,
      ),
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

  it('advances a decision that has no phase rows without creating any', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const loaded = await loadPublishedInstance(testData);
    await testData.removePhaseRows(loaded.dbInstance.id);

    const result = await callAdvancePhase(loaded, {
      fromPhaseId: 'initial',
      toPhaseId: 'final',
    });
    expect(result.conflict).toBe(false);
    expect(await listPhaseIds(loaded.dbInstance.id)).toEqual([]);
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
    expect(history!.transitionData).toEqual({ source: 'cron', batch: 42 });
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
    await holdPhaseSelection(instanceId, 'submission');
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

  it('ignores a hold added after the transition attached on its own', async ({
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
    await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Attached ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });
    const reload = async () => {
      const row = await db.query.processInstances.findFirst({
        where: { id: instanceId },
      });
      if (!row) {
        throw new Error('Failed to reload instance');
      }
      return row;
    };

    // The pipeline attaches on its own; a hold set afterwards is not retroactive.
    const attached = await callAdvancePhase(
      { setup, dbInstance: await reload() },
      { fromPhaseId: 'submission', toPhaseId: 'review' },
    );
    expect(attached.conflict).toBe(false);
    if (attached.conflict) {
      throw new Error('unreachable');
    }
    expect(attached.selectedProposalIds).toHaveLength(1);
    await holdPhaseSelection(instanceId, 'submission');

    const advanced = await callAdvancePhase(
      { setup, dbInstance: await reload() },
      { fromPhaseId: 'review', toPhaseId: 'final' },
    );
    expect(advanced.conflict).toBe(false);
  });

  it('does not hold an empty selection', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      status: ProcessStatus.PUBLISHED,
      processSchema: schemaWithPipeline,
    });
    const instanceId = setup.instance.instance.id;
    await holdPhaseSelection(instanceId, 'submission');
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
    expect(result.selectedProposalIds).toHaveLength(0);
    expect(result.selectionAwaitingApproval).toBe(false);
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
    await holdPhaseSelection(instanceId, 'submission');
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
    // The limit(2) pipeline attached two, held until the admin confirms.
    expect(result.selectionAwaitingApproval).toBe(true);
    expect(result.selectedProposalIds).toHaveLength(2);
    const attachedBefore = await db
      .select({ proposalId: decisionTransitionProposals.proposalId })
      .from(decisionTransitionProposals)
      .where(
        eq(
          decisionTransitionProposals.transitionHistoryId,
          result.transitionHistoryId,
        ),
      );
    expect(attachedBefore).toHaveLength(2);
    // Held attachments are not in the phase yet.
    await expect(
      getProposalIdsForPhase({
        instance: { ...dbInstance, currentStateId: 'review' },
        db,
      }),
    ).resolves.toEqual([]);

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const candidates = await caller.decision.listSelectionCandidates({
      processInstanceId: instanceId,
    });
    expect(candidates.totalCandidates).toBe(3);

    // The admin's list replaces the held selection.
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
    const transition = await db.query.stateTransitionHistory.findFirst({
      where: { id: result.transitionHistoryId },
      columns: { selectionConfirmedAt: true },
    });
    expect(transition?.selectionConfirmedAt).not.toBeNull();
    await expect(
      getProposalIdsForPhase({
        instance: { ...dbInstance, currentStateId: 'review' },
        db,
      }),
    ).resolves.toEqual([first.id]);
  });
});
