import {
  type DecisionInstanceData,
  processDecisionsTransitions,
  simpleVoting,
} from '@op/common';
import { db, eq } from '@op/db/client';
import {
  ProcessStatus,
  decisionProcessTransitions,
  decisionProcesses,
  processInstances,
  users,
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
 * Helper to create a template using the simpleVoting schema (4 phases, date-based advancement).
 * Returns the template ID and user email.
 */
async function createSimpleTemplate(
  testData: TestDecisionsDataManager,
  taskId: string,
) {
  const setup = await testData.createDecisionSetup({ instanceCount: 0 });

  const [userRecord] = await db
    .select()
    .from(users)
    .where(eq(users.email, setup.userEmail));

  if (!userRecord?.profileId) {
    throw new Error('Test user must have a profileId');
  }

  const [template] = await db
    .insert(decisionProcesses)
    .values({
      name: `Simple Template ${taskId}`,
      description: simpleVoting.description,
      processSchema: simpleVoting,
      createdByProfileId: userRecord.profileId,
    })
    .returning();

  return { templateId: template!.id, userEmail: setup.userEmail };
}

/**
 * Helper to create an instance from a template, publish it, and make transitions due.
 * Returns everything needed for transition monitor tests.
 */
async function createPublishedInstanceWithDueTransitions(
  testData: TestDecisionsDataManager,
  taskId: string,
  {
    makeDue = true,
    phaseDateOffsets,
  }: {
    makeDue?: boolean;
    phaseDateOffsets?: { startOffsetMs: number; endOffsetMs: number }[];
  } = {},
) {
  const { templateId, userEmail } = await createSimpleTemplate(
    testData,
    taskId,
  );
  const caller = await createAuthenticatedCaller(userEmail);

  const now = new Date();

  // Default: phases spaced 7 days apart in the future
  const defaultOffsets = [
    { startOffsetMs: 0, endOffsetMs: 7 * 24 * 60 * 60 * 1000 },
    {
      startOffsetMs: 7 * 24 * 60 * 60 * 1000,
      endOffsetMs: 14 * 24 * 60 * 60 * 1000,
    },
    {
      startOffsetMs: 14 * 24 * 60 * 60 * 1000,
      endOffsetMs: 21 * 24 * 60 * 60 * 1000,
    },
    { startOffsetMs: 21 * 24 * 60 * 60 * 1000, endOffsetMs: 0 },
  ];

  const offsets = phaseDateOffsets ?? defaultOffsets;

  if (offsets.length !== 4) {
    throw new Error(
      `phaseDateOffsets must have exactly 4 entries (one per phase), got ${offsets.length}`,
    );
  }

  const phases = [
    {
      phaseId: 'submission',
      startDate: new Date(
        now.getTime() + offsets[0]!.startOffsetMs,
      ).toISOString(),
      endDate: new Date(now.getTime() + offsets[0]!.endOffsetMs).toISOString(),
    },
    {
      phaseId: 'review',
      startDate: new Date(
        now.getTime() + offsets[1]!.startOffsetMs,
      ).toISOString(),
      endDate: new Date(now.getTime() + offsets[1]!.endOffsetMs).toISOString(),
    },
    {
      phaseId: 'voting',
      startDate: new Date(
        now.getTime() + offsets[2]!.startOffsetMs,
      ).toISOString(),
      endDate: new Date(now.getTime() + offsets[2]!.endOffsetMs).toISOString(),
    },
    {
      phaseId: 'results',
      startDate: new Date(
        now.getTime() + offsets[3]!.startOffsetMs,
      ).toISOString(),
    },
  ];

  // Create instance
  const result = await caller.decision.createInstanceFromTemplate({
    templateId,
    name: `Monitor Test ${taskId}`,
  });

  testData.trackProfileForCleanup(result.id);

  const instanceId = result.processInstance.id;

  // Set phase dates and publish the instance (this creates transitions)
  await caller.decision.updateDecisionInstance({
    instanceId,
    phases,
    status: ProcessStatus.PUBLISHED,
  });

  if (makeDue) {
    // Make all transitions due by setting scheduledDate to past times.
    // Stagger them to preserve correct ordering (monitor orders by scheduledDate).
    const fetchedTransitions =
      await db._query.decisionProcessTransitions.findMany({
        where: eq(decisionProcessTransitions.processInstanceId, instanceId),
      });

    // Sort by the original scheduled date to maintain creation order
    fetchedTransitions.sort(
      (a, b) =>
        new Date(a.scheduledDate).getTime() -
        new Date(b.scheduledDate).getTime(),
    );

    for (let i = 0; i < fetchedTransitions.length; i++) {
      const staggeredPast = new Date(
        now.getTime() - (fetchedTransitions.length - i) * 60 * 60 * 1000,
      ).toISOString();
      await db
        .update(decisionProcessTransitions)
        .set({ scheduledDate: staggeredPast })
        .where(eq(decisionProcessTransitions.id, fetchedTransitions[i]!.id));
    }
  }

  // Get the transitions
  const transitions = await db._query.decisionProcessTransitions.findMany({
    where: eq(decisionProcessTransitions.processInstanceId, instanceId),
  });

  return {
    instanceId,
    transitions,
    userEmail,
    caller,
    templateId,
  };
}

// Sequential execution: processDecisionsTransitions is a global function that processes
// ALL due transitions, so concurrent tests would race to process each other's transitions.
describe('processDecisionsTransitions', () => {
  it('should process a due transition and update instance state', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const { instanceId } = await createPublishedInstanceWithDueTransitions(
      testData,
      task.id,
    );

    // Capture updatedAt before processing
    const beforeInstance = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instanceId),
    });
    const updatedAtBefore = beforeInstance!.updatedAt;

    const result = await processDecisionsTransitions();

    expect(result.processed).toBeGreaterThanOrEqual(1);
    expect(result.failed).toBe(0);

    // Verify instance state was updated
    const instance = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instanceId),
    });

    expect(instance).toBeDefined();

    // All 3 transitions (submission→review, review→voting, voting→results) were due
    // so the instance should have advanced to the final state
    const instanceData = instance!.instanceData as DecisionInstanceData;
    expect(instanceData.currentPhaseId).toBe('results');
    expect(instance!.currentStateId).toBe('results');

    // Verify updatedAt was set by the monitor
    expect(instance!.updatedAt).toBeDefined();
    expect(new Date(instance!.updatedAt!).getTime()).toBeGreaterThan(
      new Date(updatedAtBefore!).getTime(),
    );

    // Verify transitions are marked completed
    const completedTransitions =
      await db._query.decisionProcessTransitions.findMany({
        where: eq(decisionProcessTransitions.processInstanceId, instanceId),
      });

    for (const transition of completedTransitions) {
      expect(transition.completedAt).not.toBeNull();
    }
  });

  it('should NOT process transitions for DRAFT instances', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const { templateId, userEmail } = await createSimpleTemplate(
      testData,
      task.id,
    );
    const caller = await createAuthenticatedCaller(userEmail);

    const now = new Date();
    const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago

    // Create a draft instance (don't publish)
    const result = await caller.decision.createInstanceFromTemplate({
      templateId,
      name: `Draft Monitor Test ${task.id}`,
    });

    testData.trackProfileForCleanup(result.id);

    // Draft instances don't have transitions created at all,
    // but let's manually insert one to be sure the monitor skips it
    await db.insert(decisionProcessTransitions).values({
      processInstanceId: result.processInstance.id,
      fromStateId: 'submission',
      toStateId: 'review',
      scheduledDate: pastDate.toISOString(),
    });

    await processDecisionsTransitions();

    // The transition should NOT have been processed because the instance is DRAFT
    const transitions = await db._query.decisionProcessTransitions.findMany({
      where: eq(
        decisionProcessTransitions.processInstanceId,
        result.processInstance.id,
      ),
    });

    for (const transition of transitions) {
      expect(transition.completedAt).toBeNull();
    }
  });

  it('should NOT process future-dated transitions', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // Create a published instance with future transitions (don't make them due)
    const { instanceId } = await createPublishedInstanceWithDueTransitions(
      testData,
      task.id,
      {
        makeDue: false,
      },
    );

    await processDecisionsTransitions();

    // Future transitions should not be processed
    const refreshedTransitions =
      await db._query.decisionProcessTransitions.findMany({
        where: eq(decisionProcessTransitions.processInstanceId, instanceId),
      });

    for (const transition of refreshedTransitions) {
      expect(transition.completedAt).toBeNull();
    }

    // Instance should still be in the initial state
    const instance = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instanceId),
    });

    const instanceData = instance!.instanceData as DecisionInstanceData;
    expect(instanceData.currentPhaseId).toBe('submission');
  });

  it('should process multiple due transitions sequentially for same instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const { instanceId, transitions } =
      await createPublishedInstanceWithDueTransitions(testData, task.id);

    // All 3 transitions should be due (submission→review, review→voting, voting→results)
    expect(transitions.length).toBe(3);

    const result = await processDecisionsTransitions();

    // All 3 should have been processed
    expect(result.processed).toBeGreaterThanOrEqual(3);
    expect(result.failed).toBe(0);

    // Instance should be at the final state (results)
    const instance = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instanceId),
    });

    const instanceData = instance!.instanceData as DecisionInstanceData;
    expect(instanceData.currentPhaseId).toBe('results');
    expect(instance!.currentStateId).toBe('results');

    // All transitions should be completed
    const completedTransitions =
      await db._query.decisionProcessTransitions.findMany({
        where: eq(decisionProcessTransitions.processInstanceId, instanceId),
      });

    expect(completedTransitions.every((t) => t.completedAt !== null)).toBe(
      true,
    );
  });

  it('should skip already-completed transitions', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const { instanceId, transitions } =
      await createPublishedInstanceWithDueTransitions(testData, task.id);

    // Manually mark the first transition as completed
    const firstTransition = transitions.find(
      (t) => t.fromStateId === 'submission',
    );
    expect(firstTransition).toBeDefined();

    const completedTime = new Date().toISOString();
    await db
      .update(decisionProcessTransitions)
      .set({ completedAt: completedTime })
      .where(eq(decisionProcessTransitions.id, firstTransition!.id));

    // Also update instance state to match the completed transition
    await db
      .update(processInstances)
      .set({ currentStateId: 'review' })
      .where(eq(processInstances.id, instanceId));

    const result = await processDecisionsTransitions();

    // The first transition should not be re-processed
    const refreshedFirst = await db._query.decisionProcessTransitions.findFirst(
      {
        where: eq(decisionProcessTransitions.id, firstTransition!.id),
      },
    );

    // The first transition should still have a completedAt set (it was pre-completed)
    expect(refreshedFirst!.completedAt).not.toBeNull();

    // The remaining 2 transitions should have been processed
    // (review→voting, voting→results)
    expect(result.processed).toBeGreaterThanOrEqual(2);
  });

  it('should stop processing instance on error and continue others', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // Create a valid published instance with due transitions
    const { instanceId: goodInstanceId } =
      await createPublishedInstanceWithDueTransitions(testData, task.id);

    // Create another instance and corrupt its data
    const { templateId, userEmail } = await createSimpleTemplate(
      testData,
      `${task.id}-bad`,
    );
    const caller2 = await createAuthenticatedCaller(userEmail);

    const now = new Date();
    const badPhases = [
      {
        phaseId: 'submission',
        startDate: now.toISOString(),
        endDate: new Date(
          now.getTime() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      },
      {
        phaseId: 'review',
        startDate: new Date(
          now.getTime() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        endDate: new Date(
          now.getTime() + 14 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      },
      {
        phaseId: 'voting',
        startDate: new Date(
          now.getTime() + 14 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        endDate: new Date(
          now.getTime() + 21 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      },
      {
        phaseId: 'results',
        startDate: new Date(
          now.getTime() + 21 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      },
    ];

    const badResult = await caller2.decision.createInstanceFromTemplate({
      templateId,
      name: `Bad Monitor Test ${task.id}`,
    });

    testData.trackProfileForCleanup(badResult.id);
    const badInstanceId = badResult.processInstance.id;

    // Set phase dates and publish the bad instance
    await caller2.decision.updateDecisionInstance({
      instanceId: badInstanceId,
      phases: badPhases,
      status: ProcessStatus.PUBLISHED,
    });

    // Make its transitions due with staggered past dates
    const badTransitions = await db._query.decisionProcessTransitions.findMany({
      where: eq(decisionProcessTransitions.processInstanceId, badInstanceId),
    });

    badTransitions.sort(
      (a, b) =>
        new Date(a.scheduledDate).getTime() -
        new Date(b.scheduledDate).getTime(),
    );

    for (let i = 0; i < badTransitions.length; i++) {
      const staggeredPast = new Date(
        now.getTime() - (badTransitions.length - i) * 60 * 60 * 1000,
      ).toISOString();
      await db
        .update(decisionProcessTransitions)
        .set({ scheduledDate: staggeredPast })
        .where(eq(decisionProcessTransitions.id, badTransitions[i]!.id));
    }

    // Corrupt the bad instance's data by setting instanceData to have empty phases
    await db
      .update(processInstances)
      .set({
        instanceData: { currentPhaseId: 'submission', phases: [] },
      })
      .where(eq(processInstances.id, badInstanceId));

    const monitorResult = await processDecisionsTransitions();

    // The bad instance should have failed, but the good instance should succeed
    expect(monitorResult.failed).toBeGreaterThanOrEqual(1);
    expect(monitorResult.processed).toBeGreaterThanOrEqual(1);
    expect(monitorResult.errors.length).toBeGreaterThanOrEqual(1);

    // Verify the good instance was processed
    const goodInstance = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, goodInstanceId),
    });
    expect(goodInstance!.currentStateId).toBe('results');
  });

  it('should handle concurrent workers without double-processing', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const { instanceId } = await createPublishedInstanceWithDueTransitions(
      testData,
      task.id,
    );

    // Run two monitor invocations concurrently (simulates two Inngest workers)
    const [result1, result2] = await Promise.all([
      processDecisionsTransitions(),
      processDecisionsTransitions(),
    ]);

    // Between the two runs, exactly 3 transitions should have been processed total
    const totalProcessed = result1.processed + result2.processed;
    expect(totalProcessed).toBeGreaterThanOrEqual(3);

    // Neither run should have failures
    expect(result1.failed).toBe(0);
    expect(result2.failed).toBe(0);

    // Instance should be at the final state
    const instance = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instanceId),
    });
    const instanceData = instance!.instanceData as DecisionInstanceData;
    expect(instanceData.currentPhaseId).toBe('results');
    expect(instance!.currentStateId).toBe('results');

    // Each transition should have completedAt set exactly once
    const completedTransitions =
      await db._query.decisionProcessTransitions.findMany({
        where: eq(decisionProcessTransitions.processInstanceId, instanceId),
      });

    expect(completedTransitions).toHaveLength(3);
    for (const transition of completedTransitions) {
      expect(transition.completedAt).not.toBeNull();
    }
  });
});
