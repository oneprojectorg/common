import { processDecisionsTransitions } from '@op/common';
import { db, eq } from '@op/db/client';
import {
  decisionProcesses,
  decisionProcessTransitions,
  processInstances,
} from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { appRouter } from '../../index';
import { createCallerFactory } from '../../../trpcFactory';

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

// Standard 4-phase schema for transition tests
const createPhasesProcessSchema = () => ({
  name: 'Transition Test Process',
  states: [
    { id: 'submission', name: 'Submission', type: 'initial' as const },
    { id: 'review', name: 'Review', type: 'intermediate' as const },
    { id: 'voting', name: 'Voting', type: 'intermediate' as const },
    { id: 'results', name: 'Results', type: 'final' as const },
  ],
  transitions: [
    { id: 't1', name: 'To Review', from: 'submission', to: 'review' },
    { id: 't2', name: 'To Voting', from: 'review', to: 'voting' },
    { id: 't3', name: 'To Results', from: 'voting', to: 'results' },
  ],
  initialState: 'submission',
  decisionDefinition: {},
  proposalTemplate: {},
  // Include phases array for transitionMonitor final state detection
  phases: [
    { id: 'submission', name: 'Submission', rules: { advancement: { method: 'date' } } },
    { id: 'review', name: 'Review', rules: { advancement: { method: 'date' } } },
    { id: 'voting', name: 'Voting', rules: { advancement: { method: 'date' } } },
    { id: 'results', name: 'Results', rules: {} },
  ],
});

// Instance data with a phase ending in the past (due for transition)
const createInstanceDataWithPastPhase = (currentPhaseId: string) => ({
  currentPhaseId,
  phases: [
    {
      phaseId: 'submission',
      startDate: createPastDate(14),
      endDate: createPastDate(7), // Ended a week ago
      rules: {
        proposals: { submit: true },
        advancement: { method: 'date' as const },
      },
    },
    {
      phaseId: 'review',
      startDate: createPastDate(7),
      endDate: createPastDate(1), // Ended yesterday
      rules: {
        proposals: { submit: false },
        advancement: { method: 'date' as const },
      },
    },
    {
      phaseId: 'voting',
      startDate: createPastDate(1),
      endDate: createFutureDate(7),
      rules: {
        voting: { submit: true },
        advancement: { method: 'date' as const },
      },
    },
    {
      phaseId: 'results',
      startDate: createFutureDate(7),
      rules: {},
    },
  ],
});

describe.concurrent('processDecisionsTransitions integration', () => {
  describe('processing due transitions', () => {
    it('should advance phase when transition is due', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      // Create the base setup
      const setup = await testData.createDecisionSetup({
        processName: 'Transition Test',
        instanceCount: 0,
      });

      // Update the process schema to include phases array for final state detection
      await db
        .update(decisionProcesses)
        .set({ processSchema: createPhasesProcessSchema() })
        .where(eq(decisionProcesses.id, setup.process.id));

      const caller = await createAuthenticatedCaller(setup.userEmail);

      // Create instance with submission phase already past
      const instance = await testData.createInstanceWithCustomData({
        caller,
        processId: setup.process.id,
        name: 'Due Transition Test',
        instanceData: createInstanceDataWithPastPhase('submission'),
      });

      // Grant access to the instance
      await testData.grantProfileAccess(
        instance.profileId,
        setup.user.id,
        setup.userEmail,
      );

      // Verify a transition was created and is due
      const transitions = await db.query.decisionProcessTransitions.findMany({
        where: eq(decisionProcessTransitions.processInstanceId, instance.instance.id),
      });

      expect(transitions.length).toBeGreaterThan(0);

      // Find the submission → review transition
      const dueTransition = transitions.find(
        (t) => t.fromStateId === 'submission' && t.toStateId === 'review',
      );
      expect(dueTransition).toBeDefined();
      expect(dueTransition!.completedAt).toBeNull();
      expect(new Date(dueTransition!.scheduledDate) <= new Date()).toBe(true);

      // Process all due transitions
      const result = await processDecisionsTransitions();

      expect(result.processed).toBeGreaterThanOrEqual(1);
      expect(result.failed).toBe(0);

      // Verify the instance state advanced via API
      const updatedDecision = await caller.decision.getDecisionBySlug({
        slug: instance.slug,
      });

      expect(updatedDecision.processInstance.instanceData.currentPhaseId).toBe('review');
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
        .set({ processSchema: createPhasesProcessSchema() })
        .where(eq(decisionProcesses.id, setup.process.id));

      const caller = await createAuthenticatedCaller(setup.userEmail);

      const instance = await testData.createInstanceWithCustomData({
        caller,
        processId: setup.process.id,
        name: 'State Update Test',
        instanceData: createInstanceDataWithPastPhase('submission'),
      });

      await testData.grantProfileAccess(
        instance.profileId,
        setup.user.id,
        setup.userEmail,
      );

      await processDecisionsTransitions();

      // Verify via direct DB query that both fields are updated
      const [updatedInstance] = await db
        .select()
        .from(processInstances)
        .where(eq(processInstances.id, instance.instance.id));

      expect(updatedInstance).toBeDefined();
      expect(updatedInstance!.currentStateId).toBe('review');
      const instanceData = updatedInstance!.instanceData as { currentPhaseId: string };
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
        .set({ processSchema: createPhasesProcessSchema() })
        .where(eq(decisionProcesses.id, setup.process.id));

      const caller = await createAuthenticatedCaller(setup.userEmail);

      const instance = await testData.createInstanceWithCustomData({
        caller,
        processId: setup.process.id,
        name: 'Completion Test',
        instanceData: createInstanceDataWithPastPhase('submission'),
      });

      await testData.grantProfileAccess(
        instance.profileId,
        setup.user.id,
        setup.userEmail,
      );

      // Get the transition before processing
      const [transitionBefore] = await db
        .select()
        .from(decisionProcessTransitions)
        .where(eq(decisionProcessTransitions.processInstanceId, instance.instance.id));

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
        .set({ processSchema: createPhasesProcessSchema() })
        .where(eq(decisionProcesses.id, setup.process.id));

      const caller = await createAuthenticatedCaller(setup.userEmail);

      // Create instance starting in voting phase with past end date
      const instanceData = {
        currentPhaseId: 'voting',
        phases: [
          {
            phaseId: 'submission',
            startDate: createPastDate(21),
            endDate: createPastDate(14),
            rules: { advancement: { method: 'date' as const } },
          },
          {
            phaseId: 'review',
            startDate: createPastDate(14),
            endDate: createPastDate(7),
            rules: { advancement: { method: 'date' as const } },
          },
          {
            phaseId: 'voting',
            startDate: createPastDate(7),
            endDate: createPastDate(1), // Ended yesterday
            rules: { advancement: { method: 'date' as const } },
          },
          {
            phaseId: 'results',
            startDate: createPastDate(1),
            rules: {},
          },
        ],
      };

      const instance = await testData.createInstanceWithCustomData({
        caller,
        processId: setup.process.id,
        name: 'Final Phase Test',
        instanceData,
      });

      await testData.grantProfileAccess(
        instance.profileId,
        setup.user.id,
        setup.userEmail,
      );

      // Update the instance to start from voting phase
      await db
        .update(processInstances)
        .set({ currentStateId: 'voting' })
        .where(eq(processInstances.id, instance.instance.id));

      // Insert a transition from voting to results that is due
      await db.insert(decisionProcessTransitions).values({
        processInstanceId: instance.instance.id,
        fromStateId: 'voting',
        toStateId: 'results',
        scheduledDate: createPastDate(1),
      });

      const result = await processDecisionsTransitions();

      expect(result.processed).toBeGreaterThanOrEqual(1);
      expect(result.failed).toBe(0);

      // Verify instance advanced to results (final phase)
      const updatedDecision = await caller.decision.getDecisionBySlug({
        slug: instance.slug,
      });

      expect(updatedDecision.processInstance.instanceData.currentPhaseId).toBe('results');
    });

    it('should not create transitions for final phase', async ({
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
        .set({ processSchema: createPhasesProcessSchema() })
        .where(eq(decisionProcesses.id, setup.process.id));

      const caller = await createAuthenticatedCaller(setup.userEmail);

      // Create instance already in results phase
      const instanceData = {
        currentPhaseId: 'results',
        phases: [
          { phaseId: 'submission', startDate: createPastDate(21), endDate: createPastDate(14) },
          { phaseId: 'review', startDate: createPastDate(14), endDate: createPastDate(7) },
          { phaseId: 'voting', startDate: createPastDate(7), endDate: createPastDate(1) },
          { phaseId: 'results', startDate: createPastDate(1) },
        ],
      };

      const instance = await testData.createInstanceWithCustomData({
        caller,
        processId: setup.process.id,
        name: 'Already Final',
        instanceData,
      });

      await testData.grantProfileAccess(
        instance.profileId,
        setup.user.id,
        setup.userEmail,
      );

      // Verify no transitions were created for this instance
      const transitions = await db.query.decisionProcessTransitions.findMany({
        where: eq(decisionProcessTransitions.processInstanceId, instance.instance.id),
      });

      // Results phase has no outgoing transitions (no endDate, no advancement rule)
      const outgoingFromResults = transitions.filter((t) => t.fromStateId === 'results');
      expect(outgoingFromResults).toHaveLength(0);
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
        .set({ processSchema: createPhasesProcessSchema() })
        .where(eq(decisionProcesses.id, setup.process.id));

      const caller = await createAuthenticatedCaller(setup.userEmail);

      // Create instance with all future dates
      const instanceData = {
        currentPhaseId: 'submission',
        phases: [
          {
            phaseId: 'submission',
            startDate: new Date().toISOString(),
            endDate: createFutureDate(7), // Ends in the future
            rules: { advancement: { method: 'date' as const } },
          },
          {
            phaseId: 'review',
            startDate: createFutureDate(7),
            endDate: createFutureDate(14),
            rules: { advancement: { method: 'date' as const } },
          },
          {
            phaseId: 'voting',
            startDate: createFutureDate(14),
            endDate: createFutureDate(21),
            rules: { advancement: { method: 'date' as const } },
          },
          {
            phaseId: 'results',
            startDate: createFutureDate(21),
            rules: {},
          },
        ],
      };

      const instance = await testData.createInstanceWithCustomData({
        caller,
        processId: setup.process.id,
        name: 'Future Instance',
        instanceData,
      });

      await testData.grantProfileAccess(
        instance.profileId,
        setup.user.id,
        setup.userEmail,
      );

      // Process transitions - none should be processed for this instance
      await processDecisionsTransitions();

      // Verify the instance state has not changed
      const updatedDecision = await caller.decision.getDecisionBySlug({
        slug: instance.slug,
      });

      expect(updatedDecision.processInstance.instanceData.currentPhaseId).toBe('submission');
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
        .set({ processSchema: createPhasesProcessSchema() })
        .where(eq(decisionProcesses.id, setup.process.id));

      const caller = await createAuthenticatedCaller(setup.userEmail);

      const instance = await testData.createInstanceWithCustomData({
        caller,
        processId: setup.process.id,
        name: 'Completed Test',
        instanceData: createInstanceDataWithPastPhase('submission'),
      });

      await testData.grantProfileAccess(
        instance.profileId,
        setup.user.id,
        setup.userEmail,
      );

      // Mark all transitions as already completed
      await db
        .update(decisionProcessTransitions)
        .set({ completedAt: new Date().toISOString() })
        .where(eq(decisionProcessTransitions.processInstanceId, instance.instance.id));

      // Process transitions - none should be processed
      const result = await processDecisionsTransitions();

      // This instance's transitions should not contribute to the processed count
      // (they're already completed)
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
        .set({ processSchema: createPhasesProcessSchema() })
        .where(eq(decisionProcesses.id, setup.process.id));

      const caller = await createAuthenticatedCaller(setup.userEmail);

      // Create two instances with due transitions
      const instance1 = await testData.createInstanceWithCustomData({
        caller,
        processId: setup.process.id,
        name: 'Multi Instance 1',
        instanceData: createInstanceDataWithPastPhase('submission'),
      });

      const instance2 = await testData.createInstanceWithCustomData({
        caller,
        processId: setup.process.id,
        name: 'Multi Instance 2',
        instanceData: createInstanceDataWithPastPhase('submission'),
      });

      await testData.grantProfileAccess(
        instance1.profileId,
        setup.user.id,
        setup.userEmail,
      );
      await testData.grantProfileAccess(
        instance2.profileId,
        setup.user.id,
        setup.userEmail,
      );

      // Process all due transitions
      const result = await processDecisionsTransitions();

      expect(result.processed).toBeGreaterThanOrEqual(2);
      expect(result.failed).toBe(0);

      // Verify both instances advanced
      const updated1 = await caller.decision.getDecisionBySlug({
        slug: instance1.slug,
      });
      const updated2 = await caller.decision.getDecisionBySlug({
        slug: instance2.slug,
      });

      expect(updated1.processInstance.instanceData.currentPhaseId).toBe('review');
      expect(updated2.processInstance.instanceData.currentPhaseId).toBe('review');
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
        .set({ processSchema: createPhasesProcessSchema() })
        .where(eq(decisionProcesses.id, setup.process.id));

      const caller = await createAuthenticatedCaller(setup.userEmail);

      // Create instance with both submission→review and review→voting due
      const instanceData = {
        currentPhaseId: 'submission',
        phases: [
          {
            phaseId: 'submission',
            startDate: createPastDate(21),
            endDate: createPastDate(14), // Past due
            rules: { advancement: { method: 'date' as const } },
          },
          {
            phaseId: 'review',
            startDate: createPastDate(14),
            endDate: createPastDate(7), // Also past due
            rules: { advancement: { method: 'date' as const } },
          },
          {
            phaseId: 'voting',
            startDate: createPastDate(7),
            endDate: createFutureDate(7),
            rules: { advancement: { method: 'date' as const } },
          },
          {
            phaseId: 'results',
            startDate: createFutureDate(7),
            rules: {},
          },
        ],
      };

      const instance = await testData.createInstanceWithCustomData({
        caller,
        processId: setup.process.id,
        name: 'Sequential Test',
        instanceData,
      });

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
      const updated = await caller.decision.getDecisionBySlug({
        slug: instance.slug,
      });

      expect(updated.processInstance.instanceData.currentPhaseId).toBe('voting');
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
        .set({ processSchema: createPhasesProcessSchema() })
        .where(eq(decisionProcesses.id, setup.process.id));

      const caller = await createAuthenticatedCaller(setup.userEmail);

      const instance = await testData.createInstanceWithCustomData({
        caller,
        processId: setup.process.id,
        name: 'Count Test',
        instanceData: createInstanceDataWithPastPhase('submission'),
      });

      await testData.grantProfileAccess(
        instance.profileId,
        setup.user.id,
        setup.userEmail,
      );

      const result = await processDecisionsTransitions();

      // Verify result object structure
      expect(typeof result.processed).toBe('number');
      expect(typeof result.failed).toBe('number');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.processed).toBeGreaterThanOrEqual(1);
    });
  });
});
