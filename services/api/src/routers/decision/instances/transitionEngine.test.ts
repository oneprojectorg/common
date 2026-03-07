import { TransitionEngine, simpleVoting } from '@op/common';
import { db, eq } from '@op/db/client';
import {
  ProcessStatus,
  decisionProcesses,
  processInstances,
  stateTransitionHistory,
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
 * Legacy process schema format with explicit states and transitions arrays.
 * The TransitionEngine reads `processSchema.transitions` from the process record.
 */
const legacyProcessSchema = {
  name: 'Legacy Process',
  description: 'A process schema with explicit transitions for testing',
  states: [
    { id: 'submission', name: 'Submission', type: 'initial' },
    { id: 'review', name: 'Review', type: 'intermediate' },
    { id: 'voting', name: 'Voting', type: 'intermediate' },
    { id: 'results', name: 'Results', type: 'final' },
  ],
  transitions: [
    {
      id: 'submission-to-review',
      name: 'Submit to Review',
      from: 'submission',
      to: 'review',
      rules: { type: 'manual' },
    },
    {
      id: 'review-to-voting',
      name: 'Review to Voting',
      from: 'review',
      to: 'voting',
      rules: { type: 'manual' },
    },
    {
      id: 'voting-to-results',
      name: 'Voting to Results',
      from: 'voting',
      to: 'results',
      rules: { type: 'manual' },
    },
  ],
  initialState: 'submission',
  decisionDefinition: { type: 'object' },
  proposalTemplate: { type: 'object' },
};

/**
 * Creates a process template with legacy ProcessSchema format (with transitions array)
 * and an instance with proper instanceData for TransitionEngine tests.
 */
async function createLegacyProcessWithInstance(
  testData: TestDecisionsDataManager,
  taskId: string,
  {
    currentPhaseId = 'submission',
    processSchema = legacyProcessSchema,
  }: {
    currentPhaseId?: string;
    processSchema?: Record<string, unknown>;
  } = {},
) {
  const setup = await testData.createDecisionSetup({ instanceCount: 0 });

  const [userRecord] = await db
    .select()
    .from(users)
    .where(eq(users.email, setup.userEmail));

  if (!userRecord?.profileId) {
    throw new Error('Test user must have a profileId');
  }

  // Create process with legacy schema format
  const [process] = await db
    .insert(decisionProcesses)
    .values({
      name: `Legacy Process ${taskId}`,
      description: 'Test process for TransitionEngine',
      processSchema,
      createdByProfileId: userRecord.profileId,
    })
    .returning();

  const caller = await createAuthenticatedCaller(setup.userEmail);

  // Create a simpleVoting template for createInstanceFromTemplate, then re-link to legacy process
  const [simpleTemplate] = await db
    .insert(decisionProcesses)
    .values({
      name: `Simple Template for Engine ${taskId}`,
      description: simpleVoting.description,
      processSchema: simpleVoting,
      createdByProfileId: userRecord.profileId,
    })
    .returning();

  const instanceResult = await caller.decision.createInstanceFromTemplate({
    templateId: simpleTemplate!.id,
    name: `Engine Test ${taskId}`,
  });

  testData.trackProfileForCleanup(instanceResult.id);

  const instanceId = instanceResult.processInstance.id;

  // Re-link the instance to our legacy process and set the desired current state
  await db
    .update(processInstances)
    .set({
      processId: process!.id,
      currentStateId: currentPhaseId,
      status: ProcessStatus.PUBLISHED,
      instanceData: {
        currentPhaseId,
        phases: [
          { phaseId: 'submission', name: 'Submission' },
          { phaseId: 'review', name: 'Review' },
          { phaseId: 'voting', name: 'Voting' },
          { phaseId: 'results', name: 'Results' },
        ],
      },
    })
    .where(eq(processInstances.id, instanceId));

  return {
    instanceId,
    processId: process!.id,
    user: setup.user,
    userEmail: setup.userEmail,
    caller,
  };
}

describe.concurrent('TransitionEngine', () => {
  it('should return available transitions from current state', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const { instanceId, user } = await createLegacyProcessWithInstance(
      testData,
      task.id,
      { currentPhaseId: 'submission' },
    );

    const result = await TransitionEngine.checkAvailableTransitions({
      instanceId,
      user,
    });

    expect(result.canTransition).toBe(true);
    expect(result.availableTransitions.length).toBeGreaterThanOrEqual(1);

    const reviewTransition = result.availableTransitions.find(
      (t) => t.toStateId === 'review',
    );
    expect(reviewTransition).toBeDefined();
    expect(reviewTransition!.transitionName).toBe('Submit to Review');
    expect(reviewTransition!.canExecute).toBe(true);
  });

  it('should return no transitions when at final state', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const { instanceId, user } = await createLegacyProcessWithInstance(
      testData,
      task.id,
      { currentPhaseId: 'results' },
    );

    const result = await TransitionEngine.checkAvailableTransitions({
      instanceId,
      user,
    });

    expect(result.canTransition).toBe(false);
    expect(result.availableTransitions.length).toBe(0);
  });

  it('should filter transitions by toStateId', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const { instanceId, user } = await createLegacyProcessWithInstance(
      testData,
      task.id,
      { currentPhaseId: 'submission' },
    );

    // Check with a specific toStateId
    const result = await TransitionEngine.checkAvailableTransitions({
      instanceId,
      toStateId: 'review',
      user,
    });

    expect(result.availableTransitions.length).toBe(1);
    expect(result.availableTransitions[0]!.toStateId).toBe('review');

    // Check with a toStateId that doesn't match any transition from current state
    const noResult = await TransitionEngine.checkAvailableTransitions({
      instanceId,
      toStateId: 'results',
      user,
    });

    expect(noResult.canTransition).toBe(false);
    expect(noResult.availableTransitions.length).toBe(0);
  });

  it('should execute a valid manual transition', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const { instanceId, user } = await createLegacyProcessWithInstance(
      testData,
      task.id,
      { currentPhaseId: 'submission' },
    );

    const result = await TransitionEngine.executeTransition({
      data: {
        instanceId,
        toStateId: 'review',
      },
      user,
    });

    expect(result).toBeDefined();
    expect(result!.currentStateId).toBe('review');

    // Verify state transition history was created
    const history = await db._query.stateTransitionHistory.findMany({
      where: eq(stateTransitionHistory.processInstanceId, instanceId),
    });

    expect(history.length).toBe(1);
    expect(history[0]!.fromStateId).toBe('submission');
    expect(history[0]!.toStateId).toBe('review');
  });

  it('should reject transition when conditions are not met', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // Create a process schema with a transition that has a proposalCount condition
    const schemaWithConditions = {
      ...legacyProcessSchema,
      transitions: [
        {
          id: 'submission-to-review',
          name: 'Submit to Review',
          from: 'submission',
          to: 'review',
          rules: {
            type: 'manual',
            conditions: [
              {
                type: 'proposalCount',
                operator: 'greaterThan',
                value: 0,
              },
            ],
            requireAll: true,
          },
        },
        ...legacyProcessSchema.transitions.slice(1),
      ],
    };

    const { instanceId, user } = await createLegacyProcessWithInstance(
      testData,
      task.id,
      {
        currentPhaseId: 'submission',
        processSchema: schemaWithConditions,
      },
    );

    // No proposals exist, so the proposalCount > 0 condition should fail
    const result = await TransitionEngine.checkAvailableTransitions({
      instanceId,
      toStateId: 'review',
      user,
    });

    expect(result.availableTransitions.length).toBe(1);
    expect(result.availableTransitions[0]!.canExecute).toBe(false);
    expect(result.availableTransitions[0]!.failedRules.length).toBeGreaterThan(
      0,
    );
    expect(result.canTransition).toBe(false);
  });

  it('should throw NotFoundError for non-existent instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    await expect(
      TransitionEngine.checkAvailableTransitions({
        instanceId: '00000000-0000-0000-0000-000000000000',
        user: setup.user,
      }),
    ).rejects.toThrow(/not found/i);
  });
});
