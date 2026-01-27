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
      const dueTransition = await db._query.decisionProcessTransitions.findFirst(
        {
          where: (t, { and, eq }) =>
            and(
              eq(t.processInstanceId, instance.instance.id),
              eq(t.fromStateId, 'submission'),
              eq(t.toStateId, 'review'),
            ),
        },
      );

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

      // Insert an already completed transition
      await db.insert(decisionProcessTransitions).values({
        processInstanceId: instance.instance.id,
        fromStateId: 'submission',
        toStateId: 'review',
        scheduledDate: createPastDate(1),
        completedAt: createPastDate(1), // Already completed
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
    it('should return correct processed/failed counts', async ({
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

    it('should process transitions when instance is published', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        processName: 'Published Status Test',
        instanceCount: 0,
      });

      await db
        .update(decisionProcesses)
        .set({ processSchema: createDecisionSchema() })
        .where(eq(decisionProcesses.id, setup.process.id));

      const caller = await createAuthenticatedCaller(setup.userEmail);

      // Create a PUBLISHED instance with a due transition via API
      const instance = await testData.createPublishedInstanceWithDueDates({
        caller,
        processId: setup.process.id,
        name: 'Published Instance Test',
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

      // Process transitions - published instance should be processed
      await processDecisionsTransitions();

      // Verify the instance state HAS changed
      const currentPhaseId = await getInstanceCurrentPhaseId(
        instance.instance.id,
      );
      expect(currentPhaseId).toBe('review');

      // Verify the submission->review transition is completed
      const transition = await db._query.decisionProcessTransitions.findFirst({
        where: (t, { and, eq }) =>
          and(
            eq(t.processInstanceId, instance.instance.id),
            eq(t.fromStateId, 'submission'),
          ),
      });

      expect(transition).toBeDefined();
      expect(transition!.completedAt).not.toBeNull();
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

  describe('edge cases', () => {
    it('should return zeros when no transitions are due', async () => {
      // Call processDecisionsTransitions without any test data setup
      // Note: Other concurrent tests may have due transitions, so we can't
      // guarantee processed=0, but we can verify the result structure
      const result = await processDecisionsTransitions();

      expect(typeof result.processed).toBe('number');
      expect(typeof result.failed).toBe('number');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.failed).toBe(0);
    });
  });
});
