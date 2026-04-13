import { type DecisionInstanceData } from '@op/common';
import { db, eq } from '@op/db/client';
import {
  ProcessStatus,
  decisionProcesses,
  processInstances,
  stateTransitionHistory,
} from '@op/db/schema';
import { describe, expect, it, vi } from 'vitest';

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

/**
 * Helper to create a published instance with admin access.
 * Default testMinimalSchema has 2 phases: initial → final.
 */
async function createPublishedInstance(testData: TestDecisionsDataManager) {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
    status: ProcessStatus.PUBLISHED,
  });

  const instance = setup.instances[0];
  if (!instance) {
    throw new Error('No instance created');
  }

  return { setup, instance };
}

describe.concurrent('manualTransition', () => {
  it('should advance from initial to final phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createPublishedInstance(testData);

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.manualTransition({
      instanceId: instance.instance.id,
    });

    expect(result.previousPhaseId).toBe('initial');
    expect(result.currentPhaseId).toBe('final');

    // Verify DB state
    const dbInstance = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instance.instance.id),
    });

    expect(dbInstance!.currentStateId).toBe('final');
  });

  it('should record transition in history with manual flag', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createPublishedInstance(testData);

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await caller.decision.manualTransition({
      instanceId: instance.instance.id,
    });

    const history = await db._query.stateTransitionHistory.findFirst({
      where: eq(stateTransitionHistory.processInstanceId, instance.instance.id),
    });

    expect(history).toBeDefined();
    expect(history!.fromStateId).toBe('initial');
    expect(history!.toStateId).toBe('final');
    expect(history!.transitionData).toEqual({ manual: true });
    expect(history!.triggeredByProfileId).toBeDefined();
  });

  it('should reject transition on draft instance', async ({
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

    // Instance is DRAFT by default — do not publish
    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.manualTransition({
        instanceId: instance.instance.id,
      }),
    ).rejects.toThrow('Instance must be published');
  });

  it('should reject transition when already on final phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createPublishedInstance(testData);

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Advance to final
    await caller.decision.manualTransition({
      instanceId: instance.instance.id,
    });

    // Try again — should fail
    await expect(
      caller.decision.manualTransition({
        instanceId: instance.instance.id,
      }),
    ).rejects.toThrow('Already on final phase');
  });

  it('should reject transition for non-admin user', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instance } = await createPublishedInstance(testData);

    // Create a separate user with no access to this instance
    const separateSetup = await testData.createDecisionSetup({
      instanceCount: 0,
    });

    const unauthorizedCaller = await createAuthenticatedCaller(
      separateSetup.userEmail,
    );

    await expect(
      unauthorizedCaller.decision.manualTransition({
        instanceId: instance.instance.id,
      }),
    ).rejects.toThrow();
  });

  it('should reject when fromPhaseId does not match actual phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createPublishedInstance(testData);

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Caller passes a stale phase ID — instance is on 'initial', not 'someOldPhase'
    await expect(
      caller.decision.manualTransition({
        instanceId: instance.instance.id,
        fromPhaseId: 'someOldPhase',
      }),
    ).rejects.toThrow(/Instance is on phase 'initial'/);

    // Verify the instance was NOT advanced
    const dbInstance = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instance.instance.id),
    });
    expect(dbInstance!.currentStateId).toBe('initial');
  });

  it('should advance when fromPhaseId matches actual phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createPublishedInstance(testData);

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.manualTransition({
      instanceId: instance.instance.id,
      fromPhaseId: 'initial',
    });

    expect(result.previousPhaseId).toBe('initial');
    expect(result.currentPhaseId).toBe('final');
  });

  it('should reject a stale fromPhaseId after the phase has already advanced', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createPublishedInstance(testData);

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // First call advances initial → final
    await caller.decision.manualTransition({
      instanceId: instance.instance.id,
      fromPhaseId: 'initial',
    });

    // Second call with the same fromPhaseId should be rejected as a conflict —
    // the instance has moved on, so the caller's view is stale.
    await expect(
      caller.decision.manualTransition({
        instanceId: instance.instance.id,
        fromPhaseId: 'initial',
      }),
    ).rejects.toThrow(/Instance is on phase 'final'/);
  });

  it('should reject concurrent transitions via optimistic lock', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createPublishedInstance(testData);

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Fire two transitions concurrently — one should succeed, one should fail
    const results = await Promise.allSettled([
      caller.decision.manualTransition({
        instanceId: instance.instance.id,
      }),
      caller.decision.manualTransition({
        instanceId: instance.instance.id,
      }),
    ]);

    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');

    // With a 2-phase schema, first advance goes initial→final, second fails
    // (either "already advanced" or "already on final phase")
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);
  });

  it('should advance through a 3-phase schema correctly', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createPublishedInstance(testData);

    // Patch the process schema and instance data to have 3 phases
    const threePhaseSchema = {
      id: 'initial',
      name: 'Initial Phase',
      phases: [
        {
          id: 'phase1',
          name: 'Phase 1',
          rules: {
            proposals: { submit: true },
            voting: { submit: false },
            advancement: { method: 'manual' as const },
          },
        },
        {
          id: 'phase2',
          name: 'Phase 2',
          rules: {
            proposals: { submit: false },
            voting: { submit: true },
            advancement: { method: 'manual' as const },
          },
        },
        {
          id: 'phase3',
          name: 'Phase 3',
          rules: {
            proposals: { submit: false },
            voting: { submit: false },
            advancement: { method: 'manual' as const },
          },
        },
      ],
    };

    const dbInstance = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instance.instance.id),
    });
    const instanceData = dbInstance!.instanceData as DecisionInstanceData;

    await db
      .update(processInstances)
      .set({
        currentStateId: 'phase1',
        instanceData: {
          ...instanceData,
          phases: [
            {
              phaseId: 'phase1',
              startDate: new Date().toISOString(),
              endDate: new Date(Date.now() + 7 * 86400000).toISOString(),
            },
            {
              phaseId: 'phase2',
              startDate: new Date(Date.now() + 7 * 86400000).toISOString(),
              endDate: new Date(Date.now() + 14 * 86400000).toISOString(),
            },
            {
              phaseId: 'phase3',
              startDate: new Date(Date.now() + 14 * 86400000).toISOString(),
              endDate: new Date(Date.now() + 21 * 86400000).toISOString(),
            },
          ],
        },
      })
      .where(eq(processInstances.id, instance.instance.id));

    // Also update the process schema to include all 3 phases
    await db
      .update(decisionProcesses)
      .set({ processSchema: threePhaseSchema })
      .where(eq(decisionProcesses.id, dbInstance!.processId!));

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // First transition: phase1 → phase2 (not final, should NOT trigger processResults)
    const result1 = await caller.decision.manualTransition({
      instanceId: instance.instance.id,
    });
    expect(result1.previousPhaseId).toBe('phase1');
    expect(result1.currentPhaseId).toBe('phase2');

    // Second transition: phase2 → phase3 (final phase)
    const result2 = await caller.decision.manualTransition({
      instanceId: instance.instance.id,
    });
    expect(result2.previousPhaseId).toBe('phase2');
    expect(result2.currentPhaseId).toBe('phase3');

    // Third transition should fail — already on final
    await expect(
      caller.decision.manualTransition({
        instanceId: instance.instance.id,
      }),
    ).rejects.toThrow('Already on final phase');

    // Verify history has 2 transitions
    const history = await db
      .select()
      .from(stateTransitionHistory)
      .where(
        eq(stateTransitionHistory.processInstanceId, instance.instance.id),
      );
    expect(history.length).toBe(2);
    expect(history.map((h) => h.fromStateId).sort()).toEqual([
      'phase1',
      'phase2',
    ]);
  });

  it('should succeed even if processResults throws on final phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createPublishedInstance(testData);

    // Suppress and capture console.error to verify the error is logged
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock processResults to throw — simulates a catastrophic failure
    // in the results pipeline after the phase transition has committed
    const common = await import('@op/common');
    const processResultsSpy = vi
      .spyOn(common, 'processResults')
      .mockRejectedValueOnce(new Error('Pipeline catastrophic failure'));

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // The transition itself should still succeed — processResults failure
    // is caught and logged, not propagated
    const result = await caller.decision.manualTransition({
      instanceId: instance.instance.id,
    });

    expect(result.previousPhaseId).toBe('initial');
    expect(result.currentPhaseId).toBe('final');

    // The phase advancement should be committed in DB
    const dbInstance = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instance.instance.id),
    });
    expect(dbInstance!.currentStateId).toBe('final');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `Error processing results for process instance ${instance.instance.id}`,
      ),
      expect.any(Error),
    );

    processResultsSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});
