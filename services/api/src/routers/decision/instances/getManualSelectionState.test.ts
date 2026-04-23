import { db, eq, sql } from '@op/db/client';
import {
  ProcessStatus,
  ProposalStatus,
  decisionTransitionProposals,
  processInstances,
  stateTransitionHistory,
} from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import { schemaWithoutPipeline } from '../../../test/helpers/pipelineSchemas';
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

async function seedInstance(
  testData: TestDecisionsDataManager,
): Promise<{ instanceId: string; userEmail: string; caller: Awaited<ReturnType<typeof createAuthenticatedCaller>> }> {
  const setup = await testData.createDecisionSetup({
    processSchema: schemaWithoutPipeline,
    instanceCount: 1,
    status: ProcessStatus.PUBLISHED,
  });
  const instance = setup.instances[0];
  if (!instance) {
    throw new Error('No instance created');
  }
  const caller = await createAuthenticatedCaller(setup.userEmail);
  return {
    instanceId: instance.instance.id,
    userEmail: setup.userEmail,
    caller,
  };
}

describe.concurrent('getManualSelectionState', () => {
  it('returns selectionsConfirmed=false with candidates when a phase transition attached zero proposals', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, userEmail, caller } = await seedInstance(testData);
    const submitted = await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Candidate ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });
    await db
      .delete(decisionTransitionProposals)
      .where(eq(decisionTransitionProposals.processInstanceId, instanceId));

    const state = await caller.decision.getManualSelectionState({
      processInstanceId: instanceId,
    });

    expect(state.selectionsConfirmed).toBe(false);
    expect(state.proposals.map((p) => p.id)).toContain(submitted.id);
  });

  it('returns selectionsConfirmed=true when the latest transition already has a manual selection stamp', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, userEmail, caller } = await seedInstance(testData);
    await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Candidate ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    const [transition] = await db
      .select({ id: stateTransitionHistory.id })
      .from(stateTransitionHistory)
      .where(eq(stateTransitionHistory.processInstanceId, instanceId));

    if (!transition) {
      throw new Error('Expected stateTransitionHistory row to exist');
    }

    await db
      .update(stateTransitionHistory)
      .set({
        transitionData: {
          manualSelection: {
            byProfileId: '00000000-0000-4000-8000-000000000001',
            at: new Date().toISOString(),
          },
        },
      })
      .where(eq(stateTransitionHistory.id, transition.id));

    const state = await caller.decision.getManualSelectionState({
      processInstanceId: instanceId,
    });

    expect(state.selectionsConfirmed).toBe(true);
  });

  it('returns selectionsConfirmed=true when the instance is still in the first phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, caller } = await seedInstance(testData);

    const state = await caller.decision.getManualSelectionState({
      processInstanceId: instanceId,
    });

    expect(state.selectionsConfirmed).toBe(true);
    expect(state.proposals).toEqual([]);
  });

  it('returns selectionsConfirmed=true for a legacy instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, caller } = await seedInstance(testData);

    await db
      .update(processInstances)
      .set({
        instanceData: sql`${processInstances.instanceData} || jsonb_build_object('currentStateId', 'review')`,
      })
      .where(eq(processInstances.id, instanceId));

    await db.insert(stateTransitionHistory).values({
      processInstanceId: instanceId,
      fromStateId: 'submission',
      toStateId: 'review',
    });

    const state = await caller.decision.getManualSelectionState({
      processInstanceId: instanceId,
    });

    expect(state.selectionsConfirmed).toBe(true);
  });

  it('returns selectionsConfirmed=true when the pipeline transition already attached proposals', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, userEmail, caller } = await seedInstance(testData);
    await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Proposal ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    const state = await caller.decision.getManualSelectionState({
      processInstanceId: instanceId,
    });

    expect(state.selectionsConfirmed).toBe(true);
  });

  it('rejects callers without admin access on the instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId } = await seedInstance(testData);

    const outsiderSetup = await testData.createDecisionSetup({
      instanceCount: 0,
    });
    const outsiderCaller = await createAuthenticatedCaller(
      outsiderSetup.userEmail,
    );

    await expect(
      outsiderCaller.decision.getManualSelectionState({
        processInstanceId: instanceId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });
});
