import { type DecisionInstanceData, simpleVoting } from '@op/common';
import { db, eq } from '@op/db/client';
import {
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
 * Helper to create a template (decisionProcess) in the database using the simpleVoting schema.
 * Returns the template's ID and user email which can then be used with createInstanceFromTemplate.
 *
 * Note: We insert directly into the database because the createProcess router uses the
 * legacy processSchema format, but createInstanceFromTemplate expects DecisionSchemaDefinition.
 */
async function createSimpleTemplate(
  testData: TestDecisionsDataManager,
  taskId: string,
) {
  // Get a user to set as createdByProfileId
  const setup = await testData.createDecisionSetup({ instanceCount: 0 });

  // Get the user's profileId from the users table
  const [userRecord] = await db
    .select()
    .from(users)
    .where(eq(users.email, setup.userEmail));

  if (!userRecord?.profileId) {
    throw new Error('Test user must have a profileId');
  }

  // Insert directly with DecisionSchemaDefinition format
  const [template] = await db
    .insert(decisionProcesses)
    .values({
      name: `Simple Template ${taskId}`,
      description: simpleVoting.description,
      processSchema: simpleVoting, // Store as DecisionSchemaDefinition
      createdByProfileId: userRecord.profileId,
    })
    .returning();

  return { templateId: template!.id, userEmail: setup.userEmail };
}

describe.concurrent('createInstanceFromTemplate', () => {
  it('should create an instance from a template with default phases', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // Create the template and get authenticated user
    const { templateId, userEmail } = await createSimpleTemplate(
      testData,
      task.id,
    );
    const caller = await createAuthenticatedCaller(userEmail);

    const decisionName = `Test Decision ${task.id}`;
    const result = await caller.decision.createInstanceFromTemplate({
      templateId,
      name: decisionName,
      description: 'A test decision from template',
    });

    // result.id is now the profile ID
    testData.trackProfileForCleanup(result.id);

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.name).toBe(decisionName);
    expect(result.processInstance.status).toBe('draft');

    // Verify instance data has phases
    const instance = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, result.processInstance.id),
    });

    expect(instance).toBeDefined();
    const instanceData = instance!.instanceData as DecisionInstanceData;
    expect(instanceData.phases).toBeDefined();
    expect(instanceData.phases.length).toBeGreaterThan(0);
    expect(instanceData.currentPhaseId).toBe('submission');
  });

  it('should create transitions for phases with date-based advancement', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // Create the template and get authenticated user
    const { templateId, userEmail } = await createSimpleTemplate(
      testData,
      task.id,
    );
    const caller = await createAuthenticatedCaller(userEmail);

    // Create instance with custom phase dates
    const now = new Date();
    const phase1End = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const phase2End = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days
    const phase3End = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000); // 21 days
    const phase4Start = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000); // 28 days

    const result = await caller.decision.createInstanceFromTemplate({
      templateId,
      name: `Transition Test ${task.id}`,
      phases: [
        {
          phaseId: 'submission',
          startDate: now.toISOString(),
          endDate: phase1End.toISOString(),
        },
        {
          phaseId: 'review',
          startDate: phase1End.toISOString(),
          endDate: phase2End.toISOString(),
        },
        {
          phaseId: 'voting',
          startDate: phase2End.toISOString(),
          endDate: phase3End.toISOString(),
        },
        {
          phaseId: 'results',
          startDate: phase4Start.toISOString(),
        },
      ],
    });

    // result.id is now the profile ID
    testData.trackProfileForCleanup(result.id);

    expect(result.processInstance.id).toBeDefined();

    // Verify transitions were created
    const transitions = await db._query.decisionProcessTransitions.findMany({
      where: eq(
        decisionProcessTransitions.processInstanceId,
        result.processInstance.id,
      ),
      orderBy: (transitions, { asc }) => [asc(transitions.scheduledDate)],
    });

    // The simple template has 4 phases with date-based advancement
    // Each phase that has a date-based advancement gets a transition created
    expect(transitions.length).toBeGreaterThanOrEqual(3);

    // Verify transition details - check that key transitions exist
    const submissionToReview = transitions.find(
      (t) => t.fromStateId === 'submission' && t.toStateId === 'review',
    );
    const reviewToVoting = transitions.find(
      (t) => t.fromStateId === 'review' && t.toStateId === 'voting',
    );
    const votingToResults = transitions.find(
      (t) => t.fromStateId === 'voting' && t.toStateId === 'results',
    );

    expect(submissionToReview).toBeDefined();
    expect(submissionToReview!.completedAt).toBeNull();

    expect(reviewToVoting).toBeDefined();

    expect(votingToResults).toBeDefined();
  });

  it('should accept phase settings', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // Create the template and get authenticated user
    const { templateId, userEmail } = await createSimpleTemplate(
      testData,
      task.id,
    );
    const caller = await createAuthenticatedCaller(userEmail);

    const result = await caller.decision.createInstanceFromTemplate({
      templateId,
      name: `Settings Test ${task.id}`,
      phases: [
        {
          phaseId: 'submission',
          settings: { maxProposalsPerMember: 5 },
        },
        {
          phaseId: 'voting',
          settings: { maxVotesPerMember: 3 },
        },
      ],
    });

    // result.id is now the profile ID
    testData.trackProfileForCleanup(result.id);

    const instance = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, result.processInstance.id),
    });

    const instanceData = instance!.instanceData as DecisionInstanceData;

    // Find the voting phase and check its settings
    const votingPhase = instanceData.phases.find((p) => p.phaseId === 'voting');
    expect(votingPhase?.settings?.maxVotesPerMember).toBe(3);

    // Find the submission phase and check its settings
    const submissionPhase = instanceData.phases.find(
      (p) => p.phaseId === 'submission',
    );
    expect(submissionPhase?.settings?.maxProposalsPerMember).toBe(5);
  });

  it('should require authentication', async ({ task }) => {
    // Create an unauthenticated caller
    const caller = createCaller({
      session: null,
      user: null,
    } as never);

    await expect(
      caller.decision.createInstanceFromTemplate({
        templateId: 'simple',
        name: `Auth Test ${task.id}`,
      }),
    ).rejects.toThrow();
  });

  it('should return 404 for non-existent template', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // Create setup to get an authenticated user (but don't create template)
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.createInstanceFromTemplate({
        templateId: '00000000-0000-0000-0000-000000000000', // Valid UUID that doesn't exist
        name: `Not Found Test ${task.id}`,
      }),
    ).rejects.toThrow(/not found/i);
  });

  it('should validate name minimum length', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // Create the template and get authenticated user
    const { templateId, userEmail } = await createSimpleTemplate(
      testData,
      task.id,
    );
    const caller = await createAuthenticatedCaller(userEmail);

    await expect(
      caller.decision.createInstanceFromTemplate({
        templateId,
        name: 'AB', // Less than 3 characters
      }),
    ).rejects.toThrow();
  });

  it('should create a profile for the decision instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // Create the template and get authenticated user
    const { templateId, userEmail } = await createSimpleTemplate(
      testData,
      task.id,
    );
    const caller = await createAuthenticatedCaller(userEmail);

    const decisionName = `Profile Test ${task.id}`;
    const result = await caller.decision.createInstanceFromTemplate({
      templateId,
      name: decisionName,
    });

    // result.id is now the profile ID
    testData.trackProfileForCleanup(result.id);

    // Profile data is now directly in the result
    expect(result.id).toBeDefined();
    expect(result.name).toBe(decisionName);
    expect(result.type).toBe('decision');
    expect(result.processInstance).toBeDefined();
    expect(result.processInstance.id).toBeDefined();
  });
});
