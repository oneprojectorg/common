import { TransitionEngine, simpleVoting } from '@op/common';
import { db, eq } from '@op/db/client';
import {
  ProcessStatus,
  decisionProcesses,
  decisionTransitionProposals,
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
 * Process schema with phases that have a limit(2) selectionPipeline on the
 * departing phase, and a legacy transitions array for TransitionEngine.
 */
const schemaWithPipeline = {
  name: 'Pipeline Process',
  states: [
    { id: 'submission', name: 'Submission', type: 'initial' },
    { id: 'review', name: 'Review', type: 'final' },
  ],
  transitions: [
    {
      id: 'submission-to-review',
      name: 'Submit to Review',
      from: 'submission',
      to: 'review',
      rules: { type: 'manual' },
    },
  ],
  initialState: 'submission',
  decisionDefinition: { type: 'object' },
  proposalTemplate: { type: 'object' },
  phases: [
    {
      id: 'submission',
      name: 'Submission',
      rules: {},
      selectionPipeline: {
        version: '1.0.0',
        blocks: [
          {
            id: 'limit-block',
            type: 'limit',
            count: 2,
          },
        ],
      },
    },
    {
      id: 'review',
      name: 'Review',
      rules: {},
    },
  ],
};

/**
 * Same schema without any selectionPipeline on the departing phase.
 */
const schemaWithoutPipeline = {
  ...schemaWithPipeline,
  phases: [
    {
      id: 'submission',
      name: 'Submission',
      rules: {},
    },
    {
      id: 'review',
      name: 'Review',
      rules: {},
    },
  ],
};

/**
 * Creates a process instance configured with the given processSchema,
 * starting in the 'submission' phase.
 */
async function createInstanceWithSchema(
  testData: TestDecisionsDataManager,
  taskId: string,
  processSchema: Record<string, unknown>,
) {
  const setup = await testData.createDecisionSetup({ instanceCount: 0 });

  const [userRecord] = await db
    .select()
    .from(users)
    .where(eq(users.email, setup.userEmail));

  if (!userRecord?.profileId) {
    throw new Error('Test user must have a profileId');
  }

  const [process] = await db
    .insert(decisionProcesses)
    .values({
      name: `Pipeline Process ${taskId}`,
      description: 'Test process for pipeline execution',
      processSchema,
      createdByProfileId: userRecord.profileId,
    })
    .returning();

  const caller = await createAuthenticatedCaller(setup.userEmail);

  // Create a simpleVoting template instance, then re-link to our process
  const [simpleTemplate] = await db
    .insert(decisionProcesses)
    .values({
      name: `Simple Template ${taskId}`,
      description: simpleVoting.description,
      processSchema: simpleVoting,
      createdByProfileId: userRecord.profileId,
    })
    .returning();

  const instanceResult = await caller.decision.createInstanceFromTemplate({
    templateId: simpleTemplate!.id,
    name: `Pipeline Test ${taskId}`,
  });

  testData.trackProfileForCleanup(instanceResult.id);

  const instanceId = instanceResult.processInstance.id;

  await db
    .update(processInstances)
    .set({
      processId: process!.id,
      currentStateId: 'submission',
      status: ProcessStatus.PUBLISHED,
      instanceData: {
        currentPhaseId: 'submission',
        phases: [
          { phaseId: 'submission', name: 'Submission' },
          { phaseId: 'review', name: 'Review' },
        ],
      },
    })
    .where(eq(processInstances.id, instanceId));

  return {
    instanceId,
    user: setup.user,
    userEmail: setup.userEmail,
    caller,
    testData,
  };
}

describe.concurrent('Transition pipeline: join table population', () => {
  it('creates exactly 2 join rows when selectionPipeline limits to 2 from 3 proposals', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const { instanceId, user, userEmail } = await createInstanceWithSchema(
      testData,
      task.id,
      schemaWithPipeline,
    );

    // Create 3 proposals
    for (let i = 1; i <= 3; i++) {
      await testData.createProposal({
        callerEmail: userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Proposal ${i} ${task.id}` },
      });
    }

    await TransitionEngine.executeTransition({
      data: { instanceId, toStateId: 'review' },
      user,
    });

    // Find the stateTransitionHistory row
    const [transition] = await db
      .select()
      .from(stateTransitionHistory)
      .where(eq(stateTransitionHistory.processInstanceId, instanceId))
      .limit(1);

    expect(transition).toBeDefined();

    const joinRows = await db
      .select()
      .from(decisionTransitionProposals)
      .where(
        eq(
          decisionTransitionProposals.transitionHistoryId,
          transition!.id,
        ),
      );

    expect(joinRows).toHaveLength(2);
  });

  it('creates join rows for ALL proposals when no selectionPipeline is defined', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const { instanceId, user, userEmail } = await createInstanceWithSchema(
      testData,
      task.id,
      schemaWithoutPipeline,
    );

    // Create 3 proposals
    for (let i = 1; i <= 3; i++) {
      await testData.createProposal({
        callerEmail: userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Proposal ${i} ${task.id}` },
      });
    }

    await TransitionEngine.executeTransition({
      data: { instanceId, toStateId: 'review' },
      user,
    });

    const [transition] = await db
      .select()
      .from(stateTransitionHistory)
      .where(eq(stateTransitionHistory.processInstanceId, instanceId))
      .limit(1);

    expect(transition).toBeDefined();

    const joinRows = await db
      .select()
      .from(decisionTransitionProposals)
      .where(
        eq(
          decisionTransitionProposals.transitionHistoryId,
          transition!.id,
        ),
      );

    expect(joinRows).toHaveLength(3);
  });
});
