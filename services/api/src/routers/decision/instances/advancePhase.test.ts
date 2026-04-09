import { advancePhase } from '@op/common';
import { db, eq } from '@op/db/client';
import {
  ProcessStatus,
  decisionTransitionProposals,
  processInstances,
  stateTransitionHistory,
} from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
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

  const instance = setup.instances[0];
  if (!instance) {
    throw new Error('No instance created');
  }

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
      tx,
      instance: {
        id: dbInstance.id,
        processId: dbInstance.processId,
        instanceData: dbInstance.instanceData,
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
    expect(result.transitionHistoryId).toBeDefined();

    const reloaded = await db.query.processInstances.findFirst({
      where: { id: loaded.dbInstance.id },
    });
    expect(reloaded!.currentStateId).toBe('final');

    const instanceData = reloaded!.instanceData as { currentPhaseId?: string };
    expect(instanceData.currentPhaseId).toBe('final');

    const history = await db._query.stateTransitionHistory.findFirst({
      where: eq(
        stateTransitionHistory.processInstanceId,
        loaded.dbInstance.id,
      ),
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
      fromPhaseId: 'someOtherPhase',
      toPhaseId: 'final',
    });

    expect(result.conflict).toBe(true);
    expect(result.transitionHistoryId).toBeUndefined();

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

  it('writes stateData.enteredAt for the new phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const loaded = await loadPublishedInstance(testData);

    await callAdvancePhase(loaded, {
      fromPhaseId: 'initial',
      toPhaseId: 'final',
    });

    const reloaded = await db.query.processInstances.findFirst({
      where: { id: loaded.dbInstance.id },
    });
    const stateData = (reloaded!.instanceData as Record<string, unknown>)
      .stateData as Record<string, { enteredAt?: string }> | undefined;

    expect(stateData?.final?.enteredAt).toBeDefined();
    expect(new Date(stateData!.final!.enteredAt!).getTime()).toBeGreaterThan(0);
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

    const history = await db._query.stateTransitionHistory.findFirst({
      where: eq(
        stateTransitionHistory.processInstanceId,
        loaded.dbInstance.id,
      ),
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
    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    // Create + submit a proposal so it has a proposalHistory row
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Proposal A', description: 'desc' },
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
    expect(result.survivingProposalIds).toContain(proposal.id);

    const joinRows = await db
      .select()
      .from(decisionTransitionProposals)
      .where(
        eq(decisionTransitionProposals.processInstanceId, dbInstance.id),
      );
    expect(joinRows.length).toBe(1);
    expect(joinRows[0]!.proposalId).toBe(proposal.id);
    expect(joinRows[0]!.transitionHistoryId).toBe(result.transitionHistoryId);
  });

  it('does not write join rows when there are no surviving proposals', async ({
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
    expect(result.survivingProposalIds).toEqual([]);

    const joinRows = await db
      .select()
      .from(decisionTransitionProposals)
      .where(
        eq(decisionTransitionProposals.processInstanceId, loaded.dbInstance.id),
      );
    expect(joinRows.length).toBe(0);
  });
});
