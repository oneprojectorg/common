import { type DecisionInstanceData } from '@op/common';
import { db, eq } from '@op/db/client';
import {
  ProcessStatus,
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

/**
 * Helper to create a published instance with admin access.
 * Default testMinimalSchema has 2 phases: initial → final.
 */
async function createPublishedInstance(
  testData: TestDecisionsDataManager,
  opts?: { grantAccess?: boolean },
) {
  const { grantAccess = true } = opts ?? {};

  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess,
  });

  const instance = setup.instances[0];
  if (!instance) {
    throw new Error('No instance created');
  }

  // Publish the instance
  await db
    .update(processInstances)
    .set({ status: ProcessStatus.PUBLISHED })
    .where(eq(processInstances.id, instance.instance.id));

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

    const instanceData = dbInstance!.instanceData as DecisionInstanceData;
    expect(instanceData.currentPhaseId).toBe('final');
  });

  it('should write stateData.enteredAt for the new phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createPublishedInstance(testData);

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await caller.decision.manualTransition({
      instanceId: instance.instance.id,
    });

    const dbInstance = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instance.instance.id),
    });

    const instanceData = dbInstance!.instanceData as DecisionInstanceData;
    const stateData = (instanceData as unknown as Record<string, unknown>)
      .stateData as Record<string, { enteredAt?: string }> | undefined;

    expect(stateData?.final?.enteredAt).toBeDefined();
    expect(new Date(stateData!.final!.enteredAt!).getTime()).toBeGreaterThan(0);
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
});
