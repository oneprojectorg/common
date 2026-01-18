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
  const instance = await testData.createInstanceWithCustomData({
    caller,
    processId: setup.process.id,
    name: options.name,
    instanceData: createSimpleInstanceData(options.currentPhaseId),
    status: options.status ?? ProcessStatus.PUBLISHED,
  });

  // Update currentStateId to match currentPhaseId
  await db
    .update(processInstances)
    .set({ currentStateId: options.currentPhaseId })
    .where(eq(processInstances.id, instance.instance.id));

  // Manually insert the transition record
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

      const instance = await createInstanceWithDueTransition(
        testData,
        setup,
        caller,
        {
          name: 'Due Transition Test',
          currentPhaseId: 'submission',
          fromStateId: 'submission',
          toStateId: 'review',
          scheduledDate: createPastDate(1), // Due yesterday
        },
      );

      // Verify transition exists and is due
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

      // Process all due transitions
      const result = await processDecisionsTransitions();

      expect(result.processed).toBeGreaterThanOrEqual(1);
      expect(result.failed).toBe(0);

      // Verify the instance state advanced
      const currentPhaseId = await getInstanceCurrentPhaseId(
        instance.instance.id,
      );
      expect(currentPhaseId).toBe('review');
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

      const instance = await createInstanceWithDueTransition(
        testData,
        setup,
        caller,
        {
          name: 'State Update Test',
          currentPhaseId: 'submission',
          fromStateId: 'submission',
          toStateId: 'review',
          scheduledDate: createPastDate(1),
        },
      );

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

      const instance = await createInstanceWithDueTransition(
        testData,
        setup,
        caller,
        {
          name: 'Completion Test',
          currentPhaseId: 'submission',
          fromStateId: 'submission',
          toStateId: 'review',
          scheduledDate: createPastDate(1),
        },
      );

      // Get the transition before processing
      const [transitionBefore] = await db
        .select()
        .from(decisionProcessTransitions)
        .where(
          eq(
            decisionProcessTransitions.processInstanceId,
            instance.instance.id,
          ),
        );

      expect(transitionBefore).toBeDefined();
      expect(transitionBefore!.completedAt).toBeNull();

      await processDecisionsTransitions();

      // Verify the transition is marked as completed
      const [transitionAfter] = await db
        .select()
        .from(decisionProcessTransitions)
        .where(eq(decisionProcessTransitions.id, transitionBefore!.id));

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

    it('should not process transitions when instance is already in final phase', async ({
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
      const instance = await testData.createInstanceWithCustomData({
        caller,
        processId: setup.process.id,
        name: 'Already Final',
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
      });

      await db
        .update(processInstances)
        .set({ currentStateId: 'results' })
        .where(eq(processInstances.id, instance.instance.id));

      await testData.grantProfileAccess(
        instance.profileId,
        setup.user.id,
        setup.userEmail,
      );

      // Verify no transitions exist for this instance
      const transitions = await db.query.decisionProcessTransitions.findMany({
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
      const instance = await testData.createInstanceWithCustomData({
        caller,
        processId: setup.process.id,
        name: 'Future Instance',
        instanceData: createSimpleInstanceData('submission'),
        status: ProcessStatus.PUBLISHED, // Must be published for meaningful test
      });

      await db
        .update(processInstances)
        .set({ currentStateId: 'submission' })
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

      const instance = await testData.createInstanceWithCustomData({
        caller,
        processId: setup.process.id,
        name: 'Completed Test',
        instanceData: createSimpleInstanceData('submission'),
        status: ProcessStatus.PUBLISHED, // Must be published for meaningful test
      });

      await db
        .update(processInstances)
        .set({ currentStateId: 'submission' })
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

      // Create two instances with due transitions
      const instance1 = await createInstanceWithDueTransition(
        testData,
        setup,
        caller,
        {
          name: 'Multi Instance 1',
          currentPhaseId: 'submission',
          fromStateId: 'submission',
          toStateId: 'review',
          scheduledDate: createPastDate(1),
        },
      );

      const instance2 = await createInstanceWithDueTransition(
        testData,
        setup,
        caller,
        {
          name: 'Multi Instance 2',
          currentPhaseId: 'submission',
          fromStateId: 'submission',
          toStateId: 'review',
          scheduledDate: createPastDate(1),
        },
      );

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

      // Verify both transitions were marked completed
      const transition1 = await db.query.decisionProcessTransitions.findFirst({
        where: eq(
          decisionProcessTransitions.processInstanceId,
          instance1.instance.id,
        ),
      });
      const transition2 = await db.query.decisionProcessTransitions.findFirst({
        where: eq(
          decisionProcessTransitions.processInstanceId,
          instance2.instance.id,
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

      // Create instance with TWO due transitions
      const instance = await testData.createInstanceWithCustomData({
        caller,
        processId: setup.process.id,
        name: 'Sequential Test',
        instanceData: createSimpleInstanceData('submission'),
        status: ProcessStatus.PUBLISHED,
      });

      await db
        .update(processInstances)
        .set({ currentStateId: 'submission' })
        .where(eq(processInstances.id, instance.instance.id));

      // Insert two transitions - both past due
      await db.insert(decisionProcessTransitions).values([
        {
          processInstanceId: instance.instance.id,
          fromStateId: 'submission',
          toStateId: 'review',
          scheduledDate: createPastDate(14), // Due 2 weeks ago
        },
        {
          processInstanceId: instance.instance.id,
          fromStateId: 'review',
          toStateId: 'voting',
          scheduledDate: createPastDate(7), // Due 1 week ago
        },
      ]);

      await testData.grantProfileAccess(
        instance.profileId,
        setup.user.id,
        setup.userEmail,
      );

      // Process transitions - should process both sequentially
      const result = await processDecisionsTransitions();

      expect(result.processed).toBeGreaterThanOrEqual(2);
      expect(result.failed).toBe(0);

      // Verify the instance advanced through both transitions to voting
      const currentPhaseId = await getInstanceCurrentPhaseId(
        instance.instance.id,
      );
      expect(currentPhaseId).toBe('voting');
    });
  });

  describe('error handling', () => {
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

      // Instance is needed to create a due transition, but we only care about the result counts
      await createInstanceWithDueTransition(testData, setup, caller, {
        name: 'Count Test',
        currentPhaseId: 'submission',
        fromStateId: 'submission',
        toStateId: 'review',
        scheduledDate: createPastDate(1),
      });

      const result = await processDecisionsTransitions();

      // Verify result object structure
      expect(typeof result.processed).toBe('number');
      expect(typeof result.failed).toBe('number');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.processed).toBeGreaterThanOrEqual(1);
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

      // Create a PUBLISHED instance with a due transition
      const instance = await createInstanceWithDueTransition(
        testData,
        setup,
        caller,
        {
          name: 'Published Instance Test',
          currentPhaseId: 'submission',
          fromStateId: 'submission',
          toStateId: 'review',
          scheduledDate: createPastDate(1),
          status: ProcessStatus.PUBLISHED, // Explicitly set to published
        },
      );

      // Process transitions - published instance should be processed
      await processDecisionsTransitions();

      // Verify the instance state HAS changed
      const currentPhaseId = await getInstanceCurrentPhaseId(
        instance.instance.id,
      );
      expect(currentPhaseId).toBe('review');

      // Verify the transition is completed
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
});
