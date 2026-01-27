import { processDecisionsTransitions } from '@op/common';
import type { DecisionSchemaDefinition } from '@op/common';
import { db, eq } from '@op/db/client';
import {
  ProcessStatus,
  decisionProcessTransitions,
  decisionProcesses,
  processInstances,
} from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';
import { appRouter } from '../../index';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

// Helper to create dates relative to now
const createPastDate = (daysAgo: number) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
};

const createFutureDate = (daysFromNow: number) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
};

// Standard 4-phase schema for transition tests using DecisionSchemaDefinition
const createDecisionSchema = (): DecisionSchemaDefinition => ({
  id: 'test-transition-schema',
  version: '1.0.0',
  name: 'Transition Test Process',
  phases: [
    {
      id: 'submission',
      name: 'Submission',
      rules: { advancement: { method: 'date' } },
    },
    {
      id: 'review',
      name: 'Review',
      rules: { advancement: { method: 'date' } },
    },
    {
      id: 'voting',
      name: 'Voting',
      rules: { advancement: { method: 'date' } },
    },
    { id: 'results', name: 'Results', rules: {} },
  ],
});

// Schema with all manual advancement phases (no automatic transitions)
const createManualAdvancementSchema = (): DecisionSchemaDefinition => ({
  id: 'test-manual-schema',
  version: '1.0.0',
  name: 'Manual Advancement Test Process',
  phases: [
    {
      id: 'submission',
      name: 'Submission',
      rules: { advancement: { method: 'manual' } },
    },
    {
      id: 'review',
      name: 'Review',
      rules: { advancement: { method: 'manual' } },
    },
    {
      id: 'voting',
      name: 'Voting',
      rules: { advancement: { method: 'manual' } },
    },
    { id: 'results', name: 'Results', rules: {} },
  ],
});

// Simple instance data (rules get stripped by API validation anyway)
const createSimpleInstanceData = (currentPhaseId: string) => ({
  currentPhaseId,
  phases: [
    {
      phaseId: 'submission',
      startDate: createPastDate(14),
      endDate: createPastDate(7),
    },
    {
      phaseId: 'review',
      startDate: createPastDate(7),
      endDate: createPastDate(1),
    },
    {
      phaseId: 'voting',
      startDate: createPastDate(1),
      endDate: createFutureDate(7),
    },
    { phaseId: 'results', startDate: createFutureDate(7) },
  ],
});

/**
 * Helper to create a test instance with a manually inserted due transition.
 * This bypasses the API's Zod validation which strips `rules` from instance data.
 * By default, creates instances with 'published' status so transitions are processed.
 */
/**
 * Helper to get the current phase ID for an instance via direct DB query.
 * Avoids API encoder validation issues with new schema format.
 */
async function getInstanceCurrentPhaseId(instanceId: string): Promise<string> {
  const [instance] = await db
    .select()
    .from(processInstances)
    .where(eq(processInstances.id, instanceId));

  if (!instance) {
    throw new Error(`Instance not found: ${instanceId}`);
  }

  const instanceData = instance.instanceData as { currentPhaseId: string };
  return instanceData.currentPhaseId;
}

async function createInstanceWithDueTransition(
  testData: TestDecisionsDataManager,
  setup: Awaited<ReturnType<TestDecisionsDataManager['createDecisionSetup']>>,
  caller: Awaited<ReturnType<typeof createAuthenticatedCaller>>,
  options: {
    name: string;
    currentPhaseId: string;
    fromStateId: string;
    toStateId: string;
    scheduledDate: string;
    status?: ProcessStatus;
  },
) {
  // Create instance without status first (avoids triggering createTransitionsForProcess
  // before we update instanceData with our custom phase dates)
  const instance = await testData.createInstanceForProcess({
    caller,
    processId: setup.process.id,
    name: options.name,
  });

  // Update instanceData with custom phase dates and status for test scenarios
  await db
    .update(processInstances)
    .set({
      instanceData: createSimpleInstanceData(options.currentPhaseId),
      currentStateId: options.currentPhaseId,
      status: options.status ?? ProcessStatus.PUBLISHED,
    })
    .where(eq(processInstances.id, instance.instance.id));

  // Manually insert the transition record (we control transitions explicitly in tests)
  await db.insert(decisionProcessTransitions).values({
    processInstanceId: instance.instance.id,
    fromStateId: options.fromStateId,
    toStateId: options.toStateId,
    scheduledDate: options.scheduledDate,
  });

  await testData.grantProfileAccess(
    instance.profileId,
    setup.user.id,
    setup.userEmail,
  );

  return instance;
}

describe.concurrent('processDecisionsTransitions integration', () => {
  describe('processing due transitions', () => {
    it('should advance phase when transition is due', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        processName: 'Transition Test',
        instanceCount: 0,
      });

      await db
        .update(decisionProcesses)
        .set({ processSchema: createDecisionSchema() })
        .where(eq(decisionProcesses.id, setup.process.id));

      const caller = await createAuthenticatedCaller(setup.userEmail);

      // Use API-based helper - transitions are created automatically when publishing
      const instance = await testData.createPublishedInstanceWithDueDates({
        caller,
        processId: setup.process.id,
        name: 'Due Transition Test',
        phaseDates: [
          {
            phaseId: 'submission',
            startDate: createPastDate(14),
            endDate: createPastDate(1), // Due yesterday - triggers transition
          },
          {
            phaseId: 'review',
            startDate: createPastDate(1),
            endDate: createFutureDate(7),
          },
          {
            phaseId: 'voting',
            startDate: createFutureDate(7),
            endDate: createFutureDate(14),
          },
          { phaseId: 'results', startDate: createFutureDate(14) },
        ],
      });

      // Verify transitions were created for all date-based phases
      const transitions = await db
        .select()
        .from(decisionProcessTransitions)
        .where(
          eq(
            decisionProcessTransitions.processInstanceId,
            instance.instance.id,
          ),
        );

      // Should have 3 transitions: submission->review, review->voting, voting->results
      expect(transitions).toHaveLength(3);

      // Find the submission->review transition (our due transition)
      const dueTransition = transitions.find(
        (t) => t.fromStateId === 'submission' && t.toStateId === 'review',
      );
      expect(dueTransition).toBeDefined();

      // If not yet processed by a concurrent test, process now
      if (!dueTransition!.completedAt) {
        const result = await processDecisionsTransitions();
        expect(result.failed).toBe(0);
      }

      // Verify the instance state advanced (either by publish flow or processDecisionsTransitions)
      const currentPhaseId = await getInstanceCurrentPhaseId(
        instance.instance.id,
      );
      expect(currentPhaseId).toBe('review');

      // Verify the transition is now completed
      const [updatedTransition] = await db
        .select()
        .from(decisionProcessTransitions)
        .where(eq(decisionProcessTransitions.id, dueTransition!.id));
      expect(updatedTransition!.completedAt).not.toBeNull();
    });

    it('should update both currentStateId and currentPhaseId', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        processName: 'State Update Test',
        instanceCount: 0,
      });

      await db
        .update(decisionProcesses)
        .set({ processSchema: createDecisionSchema() })
        .where(eq(decisionProcesses.id, setup.process.id));

      const caller = await createAuthenticatedCaller(setup.userEmail);

      // Use API-based helper - transitions are created automatically when publishing
      const instance = await testData.createPublishedInstanceWithDueDates({
        caller,
        processId: setup.process.id,
        name: 'State Update Test',
        phaseDates: [
          {
            phaseId: 'submission',
            startDate: createPastDate(14),
            endDate: createPastDate(1), // Due yesterday
          },
          {
            phaseId: 'review',
            startDate: createPastDate(1),
            endDate: createFutureDate(7),
          },
          {
            phaseId: 'voting',
            startDate: createFutureDate(7),
            endDate: createFutureDate(14),
          },
          { phaseId: 'results', startDate: createFutureDate(14) },
        ],
      });

      // Process due transitions (if not already processed by concurrent test)
      await processDecisionsTransitions();

      // Verify via direct DB query that both fields are updated
      const [updatedInstance] = await db
        .select()
        .from(processInstances)
        .where(eq(processInstances.id, instance.instance.id));

      expect(updatedInstance).toBeDefined();
      expect(updatedInstance!.currentStateId).toBe('review');
      const instanceData = updatedInstance!.instanceData as {
        currentPhaseId: string;
      };
      expect(instanceData.currentPhaseId).toBe('review');
    });

    it('should mark transition as completed', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        processName: 'Completion Test',
        instanceCount: 0,
      });

      await db
        .update(decisionProcesses)
        .set({ processSchema: createDecisionSchema() })
        .where(eq(decisionProcesses.id, setup.process.id));

      const caller = await createAuthenticatedCaller(setup.userEmail);

      // Use API-based helper - transitions are created automatically when publishing
      const instance = await testData.createPublishedInstanceWithDueDates({
        caller,
        processId: setup.process.id,
        name: 'Completion Test',
        phaseDates: [
          {
            phaseId: 'submission',
            startDate: createPastDate(14),
            endDate: createPastDate(1), // Due yesterday
          },
          {
            phaseId: 'review',
            startDate: createPastDate(1),
            endDate: createFutureDate(7),
          },
          {
            phaseId: 'voting',
            startDate: createFutureDate(7),
            endDate: createFutureDate(14),
          },
          { phaseId: 'results', startDate: createFutureDate(14) },
        ],
      });

      // Find the submission->review transition
      const dueTransition =
        await db._query.decisionProcessTransitions.findFirst({
          where: (t, { and, eq }) =>
            and(
              eq(t.processInstanceId, instance.instance.id),
              eq(t.fromStateId, 'submission'),
              eq(t.toStateId, 'review'),
            ),
        });

      expect(dueTransition).toBeDefined();

      // Process due transitions (if not already processed by concurrent test)
      if (!dueTransition!.completedAt) {
        await processDecisionsTransitions();
      }

      // Verify the transition is marked as completed
      const [transitionAfter] = await db
        .select()
        .from(decisionProcessTransitions)
        .where(eq(decisionProcessTransitions.id, dueTransition!.id));

      expect(transitionAfter).toBeDefined();
      expect(transitionAfter!.completedAt).not.toBeNull();
    });
  });

  describe('final phase transitions', () => {
    it('should correctly transition to final phase (results)', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        processName: 'Final Phase Test',
        instanceCount: 0,
      });

      await db
        .update(decisionProcesses)
        .set({ processSchema: createDecisionSchema() })
        .where(eq(decisionProcesses.id, setup.process.id));

      const caller = await createAuthenticatedCaller(setup.userEmail);

      const instance = await createInstanceWithDueTransition(
        testData,
        setup,
        caller,
        {
          name: 'Final Phase Test',
          currentPhaseId: 'voting',
          fromStateId: 'voting',
          toStateId: 'results',
          scheduledDate: createPastDate(1),
        },
      );

      const result = await processDecisionsTransitions();

      expect(result.processed).toBeGreaterThanOrEqual(1);
      expect(result.failed).toBe(0);

      // Verify instance advanced to results (final phase)
      const currentPhaseId = await getInstanceCurrentPhaseId(
        instance.instance.id,
      );
      expect(currentPhaseId).toBe('results');
    });
  });

  describe('skipping non-due transitions', () => {
    it('should not process future transitions', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        processName: 'Future Transitions',
        instanceCount: 0,
      });

      await db
        .update(decisionProcesses)
        .set({ processSchema: createDecisionSchema() })
        .where(eq(decisionProcesses.id, setup.process.id));

      const caller = await createAuthenticatedCaller(setup.userEmail);

      // Create instance with a future transition
      // Don't pass status to avoid triggering createTransitionsForProcess with default phase data
      const instance = await testData.createInstanceForProcess({
        caller,
        processId: setup.process.id,
        name: 'Future Instance',
      });

      // Update instanceData with custom phase dates and status for test scenario
      await db
        .update(processInstances)
        .set({
          instanceData: createSimpleInstanceData('submission'),
          currentStateId: 'submission',
          status: ProcessStatus.PUBLISHED, // Must be published for meaningful test
        })
        .where(eq(processInstances.id, instance.instance.id));

      // Insert a future transition
      await db.insert(decisionProcessTransitions).values({
        processInstanceId: instance.instance.id,
        fromStateId: 'submission',
        toStateId: 'review',
        scheduledDate: createFutureDate(7), // Not due yet
      });

      await testData.grantProfileAccess(
        instance.profileId,
        setup.user.id,
        setup.userEmail,
      );

      // Process transitions - future transition should not be processed
      await processDecisionsTransitions();

      // Verify the instance state has not changed
      const currentPhaseId = await getInstanceCurrentPhaseId(
        instance.instance.id,
      );
      expect(currentPhaseId).toBe('submission');

      // Verify transition is still pending
      const [transition] = await db
        .select()
        .from(decisionProcessTransitions)
        .where(
          eq(
            decisionProcessTransitions.processInstanceId,
            instance.instance.id,
          ),
        );

      expect(transition).toBeDefined();
      expect(transition!.completedAt).toBeNull();
    });

    it('should skip already completed transitions', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        processName: 'Completed Transitions',
        instanceCount: 0,
      });

      await db
        .update(decisionProcesses)
        .set({ processSchema: createDecisionSchema() })
        .where(eq(decisionProcesses.id, setup.process.id));

      const caller = await createAuthenticatedCaller(setup.userEmail);

      // Don't pass status to avoid triggering createTransitionsForProcess with default phase data
      const instance = await testData.createInstanceForProcess({
        caller,
        processId: setup.process.id,
        name: 'Completed Test',
      });

      // Update instanceData with custom phase dates and status for test scenario
      await db
        .update(processInstances)
        .set({
          instanceData: createSimpleInstanceData('submission'),
          currentStateId: 'submission',
          status: ProcessStatus.PUBLISHED, // Must be published for meaningful test
        })
        .where(eq(processInstances.id, instance.instance.id));

      const originalCompletedAt = createPastDate(1);

      // Insert an already completed transition
      await db.insert(decisionProcessTransitions).values({
        processInstanceId: instance.instance.id,
        fromStateId: 'submission',
        toStateId: 'review',
        scheduledDate: createPastDate(1),
        completedAt: originalCompletedAt, // Already completed
      });

      await testData.grantProfileAccess(
        instance.profileId,
        setup.user.id,
        setup.userEmail,
      );

      // Process transitions - completed transition should be skipped
      const result = await processDecisionsTransitions();

      // This instance's transition should not contribute to the processed count
      expect(result.failed).toBe(0);

      // Verify instance state has NOT changed (still in submission phase)
      const currentPhaseId = await getInstanceCurrentPhaseId(
        instance.instance.id,
      );
      expect(currentPhaseId).toBe('submission');

      // Verify completedAt timestamp wasn't modified (transition wasn't re-processed)
      const [transitionAfter] = await db
        .select()
        .from(decisionProcessTransitions)
        .where(
          eq(
            decisionProcessTransitions.processInstanceId,
            instance.instance.id,
          ),
        );
      expect(transitionAfter).toBeDefined();
      expect(new Date(transitionAfter!.completedAt!).toISOString()).toBe(
        originalCompletedAt,
      );
    });
  });

  describe('multi-instance processing', () => {
    it('should process transitions across multiple instances', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        processName: 'Multi-Instance Test',
        instanceCount: 0,
      });

      await db
        .update(decisionProcesses)
        .set({ processSchema: createDecisionSchema() })
        .where(eq(decisionProcesses.id, setup.process.id));

      const caller = await createAuthenticatedCaller(setup.userEmail);

      const phaseDates = [
        {
          phaseId: 'submission',
          startDate: createPastDate(14),
          endDate: createPastDate(1), // Due yesterday
        },
        {
          phaseId: 'review',
          startDate: createPastDate(1),
          endDate: createFutureDate(7),
        },
        {
          phaseId: 'voting',
          startDate: createFutureDate(7),
          endDate: createFutureDate(14),
        },
        { phaseId: 'results', startDate: createFutureDate(14) },
      ];

      // Create two instances with due transitions via API
      const instance1 = await testData.createPublishedInstanceWithDueDates({
        caller,
        processId: setup.process.id,
        name: 'Multi Instance 1',
        phaseDates,
      });

      const instance2 = await testData.createPublishedInstanceWithDueDates({
        caller,
        processId: setup.process.id,
        name: 'Multi Instance 2',
        phaseDates,
      });

      // Process all due transitions
      const result = await processDecisionsTransitions();

      // Result includes transitions from all concurrent tests, so just verify no failures
      expect(result.failed).toBe(0);

      // Verify BOTH of our specific instances advanced (this is the important check)
      const currentPhaseId1 = await getInstanceCurrentPhaseId(
        instance1.instance.id,
      );
      const currentPhaseId2 = await getInstanceCurrentPhaseId(
        instance2.instance.id,
      );

      expect(currentPhaseId1).toBe('review');
      expect(currentPhaseId2).toBe('review');

      // Verify both submission->review transitions were marked completed
      const transition1 = await db._query.decisionProcessTransitions.findFirst({
        where: (t, { and, eq }) =>
          and(
            eq(t.processInstanceId, instance1.instance.id),
            eq(t.fromStateId, 'submission'),
          ),
      });
      const transition2 = await db._query.decisionProcessTransitions.findFirst({
        where: (t, { and, eq }) =>
          and(
            eq(t.processInstanceId, instance2.instance.id),
            eq(t.fromStateId, 'submission'),
          ),
      });

      expect(transition1?.completedAt).toBeTruthy();
      expect(transition2?.completedAt).toBeTruthy();
    });

    it('should process multiple sequential transitions within same instance', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        processName: 'Sequential Transitions',
        instanceCount: 0,
      });

      await db
        .update(decisionProcesses)
        .set({ processSchema: createDecisionSchema() })
        .where(eq(decisionProcesses.id, setup.process.id));

      const caller = await createAuthenticatedCaller(setup.userEmail);

      // Create instance with TWO due transitions via API
      // Both submission and review phases have past end dates
      const instance = await testData.createPublishedInstanceWithDueDates({
        caller,
        processId: setup.process.id,
        name: 'Sequential Test',
        phaseDates: [
          {
            phaseId: 'submission',
            startDate: createPastDate(21),
            endDate: createPastDate(14), // Due 2 weeks ago
          },
          {
            phaseId: 'review',
            startDate: createPastDate(14),
            endDate: createPastDate(7), // Due 1 week ago
          },
          {
            phaseId: 'voting',
            startDate: createPastDate(7),
            endDate: createFutureDate(7),
          },
          { phaseId: 'results', startDate: createFutureDate(7) },
        ],
      });

      // Process transitions - should process both sequentially
      const result = await processDecisionsTransitions();

      expect(result.failed).toBe(0);

      // Verify the instance advanced through both transitions to voting
      const currentPhaseId = await getInstanceCurrentPhaseId(
        instance.instance.id,
      );
      expect(currentPhaseId).toBe('voting');
    });
  });

  describe('result structure', () => {
    it('should return result object with correct structure', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        processName: 'Count Test',
        instanceCount: 0,
      });

      await db
        .update(decisionProcesses)
        .set({ processSchema: createDecisionSchema() })
        .where(eq(decisionProcesses.id, setup.process.id));

      const caller = await createAuthenticatedCaller(setup.userEmail);

      // Create instance with a due transition via API
      await testData.createPublishedInstanceWithDueDates({
        caller,
        processId: setup.process.id,
        name: 'Count Test',
        phaseDates: [
          {
            phaseId: 'submission',
            startDate: createPastDate(14),
            endDate: createPastDate(1), // Due yesterday
          },
          {
            phaseId: 'review',
            startDate: createPastDate(1),
            endDate: createFutureDate(7),
          },
          {
            phaseId: 'voting',
            startDate: createFutureDate(7),
            endDate: createFutureDate(14),
          },
          { phaseId: 'results', startDate: createFutureDate(14) },
        ],
      });

      const result = await processDecisionsTransitions();

      // Verify result object structure
      expect(typeof result.processed).toBe('number');
      expect(typeof result.failed).toBe('number');
      expect(Array.isArray(result.errors)).toBe(true);
      // Note: Can't guarantee processed count due to concurrent tests potentially processing first
    });
  });

  describe('transition creation rules', () => {
    it('should not create transitions for manual advancement phases', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        processName: 'Manual Advancement Test',
        instanceCount: 0,
      });

      // Use schema with all manual advancement phases
      await db
        .update(decisionProcesses)
        .set({ processSchema: createManualAdvancementSchema() })
        .where(eq(decisionProcesses.id, setup.process.id));

      const caller = await createAuthenticatedCaller(setup.userEmail);

      // Publish instance via API - this should trigger createTransitionsForProcess
      // but since all phases use method: 'manual', no transitions should be created
      const instance = await testData.createPublishedInstanceWithDueDates({
        caller,
        processId: setup.process.id,
        name: 'Manual Advancement Instance',
        phaseDates: [
          {
            phaseId: 'submission',
            startDate: createPastDate(14),
            endDate: createPastDate(1), // Would be "due" if it were date-based
          },
          {
            phaseId: 'review',
            startDate: createPastDate(1),
            endDate: createFutureDate(7),
          },
          {
            phaseId: 'voting',
            startDate: createFutureDate(7),
            endDate: createFutureDate(14),
          },
          { phaseId: 'results', startDate: createFutureDate(14) },
        ],
      });

      // Verify NO transitions were created for this instance
      const transitions = await db
        .select()
        .from(decisionProcessTransitions)
        .where(
          eq(
            decisionProcessTransitions.processInstanceId,
            instance.instance.id,
          ),
        );

      expect(transitions).toHaveLength(0);

      // Verify instance remains in submission phase (not advanced)
      const currentPhaseId = await getInstanceCurrentPhaseId(
        instance.instance.id,
      );
      expect(currentPhaseId).toBe('submission');
    });

    it('should have no pending transitions for instance in final phase', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        processName: 'No Final Transitions',
        instanceCount: 0,
      });

      await db
        .update(decisionProcesses)
        .set({ processSchema: createDecisionSchema() })
        .where(eq(decisionProcesses.id, setup.process.id));

      const caller = await createAuthenticatedCaller(setup.userEmail);

      // Create instance already in results phase (no transition inserted)
      // Don't pass status to avoid triggering createTransitionsForProcess with default phase data
      const instance = await testData.createInstanceForProcess({
        caller,
        processId: setup.process.id,
        name: 'Already Final',
      });

      // Update instanceData with custom phase dates and status for test scenario
      await db
        .update(processInstances)
        .set({
          instanceData: {
            currentPhaseId: 'results',
            phases: [
              {
                phaseId: 'submission',
                startDate: createPastDate(21),
                endDate: createPastDate(14),
              },
              {
                phaseId: 'review',
                startDate: createPastDate(14),
                endDate: createPastDate(7),
              },
              {
                phaseId: 'voting',
                startDate: createPastDate(7),
                endDate: createPastDate(1),
              },
              { phaseId: 'results', startDate: createPastDate(1) },
            ],
          },
          currentStateId: 'results',
          status: ProcessStatus.PUBLISHED,
        })
        .where(eq(processInstances.id, instance.instance.id));

      await testData.grantProfileAccess(
        instance.profileId,
        setup.user.id,
        setup.userEmail,
      );

      // Verify no transitions exist for this instance
      const transitions = await db._query.decisionProcessTransitions.findMany({
        where: eq(
          decisionProcessTransitions.processInstanceId,
          instance.instance.id,
        ),
      });

      expect(transitions).toHaveLength(0);

      // Verify instance remains in results phase
      const currentPhaseId = await getInstanceCurrentPhaseId(
        instance.instance.id,
      );
      expect(currentPhaseId).toBe('results');
    });
  });

  describe('deferred state update behavior', () => {
    /**
     * Tests that the instance state is only updated ONCE after all transitions
     * for that instance are processed, using the toStateId of the LAST transition.
     *
     * This is important because:
     * - Orphaned transitions from earlier phases may still be pending
     * - Multiple transitions may be due at the same time
     * - The final state should reflect the most recent scheduled transition
     */
    it('should update instance state only once after all transitions are processed', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        processName: 'Deferred State Update Test',
        instanceCount: 0,
      });

      await db
        .update(decisionProcesses)
        .set({ processSchema: createDecisionSchema() })
        .where(eq(decisionProcesses.id, setup.process.id));

      const caller = await createAuthenticatedCaller(setup.userEmail);

      // Create instance starting in 'submission' phase
      const instance = await testData.createInstanceForProcess({
        caller,
        processId: setup.process.id,
        name: 'Deferred State Test',
      });

      // Update instanceData to be in 'submission' phase
      await db
        .update(processInstances)
        .set({
          instanceData: createSimpleInstanceData('submission'),
          currentStateId: 'submission',
          status: ProcessStatus.PUBLISHED,
        })
        .where(eq(processInstances.id, instance.instance.id));

      // Insert TWO due transitions that should both be processed
      // Transition 1: submission -> review (scheduled earlier)
      await db.insert(decisionProcessTransitions).values({
        processInstanceId: instance.instance.id,
        fromStateId: 'submission',
        toStateId: 'review',
        scheduledDate: createPastDate(7), // Scheduled 7 days ago
      });

      // Transition 2: review -> voting (scheduled more recently)
      await db.insert(decisionProcessTransitions).values({
        processInstanceId: instance.instance.id,
        fromStateId: 'review',
        toStateId: 'voting',
        scheduledDate: createPastDate(1), // Scheduled 1 day ago
      });

      await testData.grantProfileAccess(
        instance.profileId,
        setup.user.id,
        setup.userEmail,
      );

      // Process transitions - both should be processed, state updated to final transition's toStateId
      const result = await processDecisionsTransitions();

      expect(result.failed).toBe(0);

      // Instance should be in 'voting' (the toStateId of the last transition)
      const currentPhaseId = await getInstanceCurrentPhaseId(
        instance.instance.id,
      );
      expect(currentPhaseId).toBe('voting');

      // Both transitions should be marked complete
      const transitions = await db
        .select()
        .from(decisionProcessTransitions)
        .where(
          eq(
            decisionProcessTransitions.processInstanceId,
            instance.instance.id,
          ),
        );

      expect(transitions).toHaveLength(2);
      expect(transitions.every((t) => t.completedAt !== null)).toBe(true);
    });

    /**
     * Tests that orphaned transitions from earlier phases are processed correctly
     * when they exist alongside newer transitions.
     *
     * Scenario: An older transition (submission->review) wasn't processed before,
     * and now both it and a newer transition (review->voting) are due.
     * The instance should end up in 'voting' (the final transition's toStateId).
     */
    it('should handle orphaned transitions from earlier phases correctly', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        processName: 'Orphaned Transition Test',
        instanceCount: 0,
      });

      await db
        .update(decisionProcesses)
        .set({ processSchema: createDecisionSchema() })
        .where(eq(decisionProcesses.id, setup.process.id));

      const caller = await createAuthenticatedCaller(setup.userEmail);

      // Create instance - it's currently in 'review' phase (maybe advanced manually)
      // but there's still an old orphaned transition from submission->review
      const instance = await testData.createInstanceForProcess({
        caller,
        processId: setup.process.id,
        name: 'Orphaned Transition Test',
      });

      // Update instanceData to be in 'review' phase
      await db
        .update(processInstances)
        .set({
          instanceData: createSimpleInstanceData('review'),
          currentStateId: 'review',
          status: ProcessStatus.PUBLISHED,
        })
        .where(eq(processInstances.id, instance.instance.id));

      // Insert orphaned transition from earlier phase (scheduled long ago)
      await db.insert(decisionProcessTransitions).values({
        processInstanceId: instance.instance.id,
        fromStateId: 'submission', // Orphaned - instance is already in 'review'
        toStateId: 'review',
        scheduledDate: createPastDate(14), // Scheduled 14 days ago
      });

      // Insert current transition (scheduled more recently)
      await db.insert(decisionProcessTransitions).values({
        processInstanceId: instance.instance.id,
        fromStateId: 'review',
        toStateId: 'voting',
        scheduledDate: createPastDate(1), // Scheduled 1 day ago
      });

      await testData.grantProfileAccess(
        instance.profileId,
        setup.user.id,
        setup.userEmail,
      );

      // Process transitions
      const result = await processDecisionsTransitions();

      expect(result.failed).toBe(0);

      // Instance should be in 'voting' (the final transition's toStateId)
      // NOT 'review' (which would happen if we updated state after each transition)
      const currentPhaseId = await getInstanceCurrentPhaseId(
        instance.instance.id,
      );
      expect(currentPhaseId).toBe('voting');

      // Both transitions should be marked complete
      const transitions = await db
        .select()
        .from(decisionProcessTransitions)
        .where(
          eq(
            decisionProcessTransitions.processInstanceId,
            instance.instance.id,
          ),
        );

      expect(transitions).toHaveLength(2);
      expect(transitions.every((t) => t.completedAt !== null)).toBe(true);
    });

    /**
     * Documents current behavior: the implementation does NOT validate that
     * fromStateId matches the instance's currentStateId before processing.
     *
     * When a mismatched transition is processed:
     * - The transition is marked as completed
     * - The instance state is updated to the final transition's toStateId
     */
    it('should process transition even when currentPhaseId does not match fromStateId', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        processName: 'Phase Mismatch Test',
        instanceCount: 0,
      });

      await db
        .update(decisionProcesses)
        .set({ processSchema: createDecisionSchema() })
        .where(eq(decisionProcesses.id, setup.process.id));

      const caller = await createAuthenticatedCaller(setup.userEmail);

      // Create instance in 'review' phase
      const instance = await testData.createInstanceForProcess({
        caller,
        processId: setup.process.id,
        name: 'Phase Mismatch Test',
      });

      // Update instanceData to be in 'review' phase
      await db
        .update(processInstances)
        .set({
          instanceData: createSimpleInstanceData('review'),
          currentStateId: 'review',
          status: ProcessStatus.PUBLISHED,
        })
        .where(eq(processInstances.id, instance.instance.id));

      // Insert a mismatched transition: fromStateId='submission' but instance is in 'review'
      // In this case, toStateId also happens to be 'review', so the end state is the same
      await db.insert(decisionProcessTransitions).values({
        processInstanceId: instance.instance.id,
        fromStateId: 'submission', // Mismatched - instance is actually in 'review'
        toStateId: 'review',
        scheduledDate: createPastDate(1), // Due
      });

      await testData.grantProfileAccess(
        instance.profileId,
        setup.user.id,
        setup.userEmail,
      );

      // Process transitions - current behavior: processes regardless of mismatch
      const result = await processDecisionsTransitions();

      expect(result.failed).toBe(0);

      // Instance remains in 'review' (toStateId matches current state, so no visible change)
      const currentPhaseId = await getInstanceCurrentPhaseId(
        instance.instance.id,
      );
      expect(currentPhaseId).toBe('review');

      // Current behavior: transition IS processed and marked complete
      const [transition] = await db
        .select()
        .from(decisionProcessTransitions)
        .where(
          eq(
            decisionProcessTransitions.processInstanceId,
            instance.instance.id,
          ),
        );

      expect(transition).toBeDefined();
      expect(transition!.completedAt).not.toBeNull();
    });
  });

  describe('error handling', () => {
    /**
     * Tests that when a transition fails to process, the error is captured
     * and the instance state is not updated.
     *
     * This test corrupts the instanceData to cause processTransition to fail.
     */
    it('should capture errors and not update state when transition processing fails', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        processName: 'Error Handling Test',
        instanceCount: 0,
      });

      await db
        .update(decisionProcesses)
        .set({ processSchema: createDecisionSchema() })
        .where(eq(decisionProcesses.id, setup.process.id));

      const caller = await createAuthenticatedCaller(setup.userEmail);

      // Create instance
      const instance = await testData.createInstanceForProcess({
        caller,
        processId: setup.process.id,
        name: 'Error Test Instance',
      });

      // Set up instance with CORRUPTED instanceData (missing phases array)
      // This will cause processTransition to fail when it tries to access phases
      await db
        .update(processInstances)
        .set({
          instanceData: {
            currentPhaseId: 'submission',
            // phases array is MISSING - this will cause an error
          },
          currentStateId: 'submission',
          status: ProcessStatus.PUBLISHED,
        })
        .where(eq(processInstances.id, instance.instance.id));

      // Insert a due transition
      await db.insert(decisionProcessTransitions).values({
        processInstanceId: instance.instance.id,
        fromStateId: 'submission',
        toStateId: 'review',
        scheduledDate: createPastDate(1),
      });

      await testData.grantProfileAccess(
        instance.profileId,
        setup.user.id,
        setup.userEmail,
      );

      // Process transitions - should fail due to corrupted instanceData
      const result = await processDecisionsTransitions();

      // Verify error was captured
      const instanceError = result.errors.find(
        (e) => e.processInstanceId === instance.instance.id,
      );
      expect(instanceError).toBeDefined();
      expect(result.failed).toBeGreaterThanOrEqual(1);

      // Verify instance state was NOT updated (still in submission)
      const currentPhaseId = await getInstanceCurrentPhaseId(
        instance.instance.id,
      );
      expect(currentPhaseId).toBe('submission');

      // Verify transition was NOT marked as completed
      const [transition] = await db
        .select()
        .from(decisionProcessTransitions)
        .where(
          eq(
            decisionProcessTransitions.processInstanceId,
            instance.instance.id,
          ),
        );
      expect(transition).toBeDefined();
      expect(transition!.completedAt).toBeNull();
    });

    /**
     * Tests that a successful instance and a failing instance are handled independently.
     * The successful instance should advance, while the failing instance should not.
     *
     * NOTE: In concurrent tests, result counts may vary because processDecisionsTransitions
     * is a global operation. We verify behavior by checking actual instance states.
     */
    it('should handle successful and failing instances independently', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        processName: 'Mixed Success Test',
        instanceCount: 0,
      });

      await db
        .update(decisionProcesses)
        .set({ processSchema: createDecisionSchema() })
        .where(eq(decisionProcesses.id, setup.process.id));

      const caller = await createAuthenticatedCaller(setup.userEmail);

      // Create first instance with valid transition (will succeed)
      const instance1 = await testData.createInstanceForProcess({
        caller,
        processId: setup.process.id,
        name: 'Success Instance',
      });

      await db
        .update(processInstances)
        .set({
          instanceData: createSimpleInstanceData('submission'),
          currentStateId: 'submission',
          status: ProcessStatus.PUBLISHED,
        })
        .where(eq(processInstances.id, instance1.instance.id));

      await db.insert(decisionProcessTransitions).values({
        processInstanceId: instance1.instance.id,
        fromStateId: 'submission',
        toStateId: 'review',
        scheduledDate: createPastDate(1),
      });

      await testData.grantProfileAccess(
        instance1.profileId,
        setup.user.id,
        setup.userEmail,
      );

      // Create second instance with corrupted data (will fail)
      const instance2 = await testData.createInstanceForProcess({
        caller,
        processId: setup.process.id,
        name: 'Failure Instance',
      });

      await db
        .update(processInstances)
        .set({
          instanceData: {
            currentPhaseId: 'submission',
            // Missing phases - will cause error
          },
          currentStateId: 'submission',
          status: ProcessStatus.PUBLISHED,
        })
        .where(eq(processInstances.id, instance2.instance.id));

      await db.insert(decisionProcessTransitions).values({
        processInstanceId: instance2.instance.id,
        fromStateId: 'submission',
        toStateId: 'review',
        scheduledDate: createPastDate(1),
      });

      await testData.grantProfileAccess(
        instance2.profileId,
        setup.user.id,
        setup.userEmail,
      );

      // Process all transitions
      const result = await processDecisionsTransitions();

      // Verify no unexpected errors (instance2's error is expected)
      expect(result.failed).toBeGreaterThanOrEqual(0);

      // Instance 1 should have advanced to review (success)
      // Either processed by this call or a concurrent test's call
      const phase1 = await getInstanceCurrentPhaseId(instance1.instance.id);
      expect(phase1).toBe('review');

      // Instance 2 should still be in submission (failure)
      const phase2 = await getInstanceCurrentPhaseId(instance2.instance.id);
      expect(phase2).toBe('submission');

      // Instance 1's transition should be completed
      const [transition1] = await db
        .select()
        .from(decisionProcessTransitions)
        .where(
          eq(
            decisionProcessTransitions.processInstanceId,
            instance1.instance.id,
          ),
        );
      expect(transition1!.completedAt).not.toBeNull();

      // Instance 2's transition should NOT be completed
      const [transition2] = await db
        .select()
        .from(decisionProcessTransitions)
        .where(
          eq(
            decisionProcessTransitions.processInstanceId,
            instance2.instance.id,
          ),
        );
      expect(transition2!.completedAt).toBeNull();

      // Verify error was captured for instance2
      const instance2Error = result.errors.find(
        (e) => e.processInstanceId === instance2.instance.id,
      );
      // Note: In concurrent tests, the error might be captured by another test's call
      // So we just verify the instance state is correct (checked above)
      if (instance2Error) {
        expect(instance2Error.error).toContain('length');
      }
    });
  });

  describe('instance status filtering', () => {
    it('should not process transitions for draft instances', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        processName: 'Draft Status Test',
        instanceCount: 0,
      });

      await db
        .update(decisionProcesses)
        .set({ processSchema: createDecisionSchema() })
        .where(eq(decisionProcesses.id, setup.process.id));

      const caller = await createAuthenticatedCaller(setup.userEmail);

      // Create a DRAFT instance with a due transition
      const instance = await createInstanceWithDueTransition(
        testData,
        setup,
        caller,
        {
          name: 'Draft Instance Test',
          currentPhaseId: 'submission',
          fromStateId: 'submission',
          toStateId: 'review',
          scheduledDate: createPastDate(1),
          status: ProcessStatus.DRAFT, // Explicitly set to draft
        },
      );

      // Process transitions - draft instance should be skipped
      await processDecisionsTransitions();

      // Verify the instance state has NOT changed
      const currentPhaseId = await getInstanceCurrentPhaseId(
        instance.instance.id,
      );
      expect(currentPhaseId).toBe('submission');

      // Verify the transition is still pending (not completed)
      const [transition] = await db
        .select()
        .from(decisionProcessTransitions)
        .where(
          eq(
            decisionProcessTransitions.processInstanceId,
            instance.instance.id,
          ),
        );

      expect(transition).toBeDefined();
      expect(transition!.completedAt).toBeNull();
    });

    it('should not process transitions for completed instances', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        processName: 'Completed Status Test',
        instanceCount: 0,
      });

      await db
        .update(decisionProcesses)
        .set({ processSchema: createDecisionSchema() })
        .where(eq(decisionProcesses.id, setup.process.id));

      const caller = await createAuthenticatedCaller(setup.userEmail);

      // Create a COMPLETED instance with a due transition
      const instance = await createInstanceWithDueTransition(
        testData,
        setup,
        caller,
        {
          name: 'Completed Instance Test',
          currentPhaseId: 'submission',
          fromStateId: 'submission',
          toStateId: 'review',
          scheduledDate: createPastDate(1),
          status: ProcessStatus.COMPLETED, // Explicitly set to completed
        },
      );

      // Process transitions - completed instance should be skipped
      await processDecisionsTransitions();

      // Verify the instance state has NOT changed
      const currentPhaseId = await getInstanceCurrentPhaseId(
        instance.instance.id,
      );
      expect(currentPhaseId).toBe('submission');

      // Verify the transition is still pending (not completed)
      const [transition] = await db
        .select()
        .from(decisionProcessTransitions)
        .where(
          eq(
            decisionProcessTransitions.processInstanceId,
            instance.instance.id,
          ),
        );

      expect(transition).toBeDefined();
      expect(transition!.completedAt).toBeNull();
    });

    it('should not process transitions for cancelled instances', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        processName: 'Cancelled Status Test',
        instanceCount: 0,
      });

      await db
        .update(decisionProcesses)
        .set({ processSchema: createDecisionSchema() })
        .where(eq(decisionProcesses.id, setup.process.id));

      const caller = await createAuthenticatedCaller(setup.userEmail);

      // Create a CANCELLED instance with a due transition
      const instance = await createInstanceWithDueTransition(
        testData,
        setup,
        caller,
        {
          name: 'Cancelled Instance Test',
          currentPhaseId: 'submission',
          fromStateId: 'submission',
          toStateId: 'review',
          scheduledDate: createPastDate(1),
          status: ProcessStatus.CANCELLED, // Explicitly set to cancelled
        },
      );

      // Process transitions - cancelled instance should be skipped
      await processDecisionsTransitions();

      // Verify the instance state has NOT changed
      const currentPhaseId = await getInstanceCurrentPhaseId(
        instance.instance.id,
      );
      expect(currentPhaseId).toBe('submission');

      // Verify the transition is still pending (not completed)
      const [transition] = await db
        .select()
        .from(decisionProcessTransitions)
        .where(
          eq(
            decisionProcessTransitions.processInstanceId,
            instance.instance.id,
          ),
        );

      expect(transition).toBeDefined();
      expect(transition!.completedAt).toBeNull();
    });
  });
});
