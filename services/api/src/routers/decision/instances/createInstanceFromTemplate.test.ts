import {
  type DecisionInstanceData,
  type DecisionSchemaDefinition,
  simpleVoting,
} from '@op/common';
import { db, eq } from '@op/db/client';
import { decisionProcesses, users } from '@op/db/schema';
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
  schemaOverrides?: Partial<DecisionSchemaDefinition>,
) {
  const schema: DecisionSchemaDefinition = {
    ...simpleVoting,
    ...schemaOverrides,
  };

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
      description: schema.description,
      processSchema: schema,
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
    });

    // result.id is now the profile ID
    testData.trackProfileForCleanup(result.id);

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.name).toBe(decisionName);
    expect(result.processInstance.status).toBe('draft');

    // Verify instance data has phases
    const instance = await db.query.processInstances.findFirst({
      where: { id: result.processInstance.id },
    });

    expect(instance).toBeDefined();
    const instanceData = instance!.instanceData as DecisionInstanceData;
    expect(instanceData.phases).toBeDefined();
    expect(instanceData.phases.length).toBeGreaterThan(0);
    expect(instance!.currentStateId).toBe('submission');
  });

  it('should NOT create transitions for DRAFT instances (transitions are created on publish)', async ({
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

    const result = await caller.decision.createInstanceFromTemplate({
      templateId,
      name: `Transition Test ${task.id}`,
    });

    // result.id is now the profile ID
    testData.trackProfileForCleanup(result.id);

    expect(result.processInstance.id).toBeDefined();
    expect(result.processInstance.status).toBe('draft');

    // Verify NO transitions were created for DRAFT instance
    // Transitions are only created when the instance is published
    const transitions = await db.query.decisionProcessTransitions.findMany({
      where: { processInstanceId: result.processInstance.id },
    });

    expect(transitions.length).toBe(0);
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

  it('should copy proposalTemplate from template into instance data', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const proposalTemplate = {
      type: 'object' as const,
      properties: {
        title: { type: 'string' as const, title: 'Title' },
        description: { type: 'string' as const, title: 'Description' },
      },
      required: ['title'],
    };

    const { templateId, userEmail } = await createSimpleTemplate(
      testData,
      task.id,
      { proposalTemplate },
    );
    const caller = await createAuthenticatedCaller(userEmail);

    const result = await caller.decision.createInstanceFromTemplate({
      templateId,
      name: `Proposal Template Decision ${task.id}`,
    });

    testData.trackProfileForCleanup(result.id);

    const instance = await db.query.processInstances.findFirst({
      where: { id: result.processInstance.id },
    });

    const instanceData = instance!.instanceData as DecisionInstanceData;
    expect(instanceData.proposalTemplate).toEqual(proposalTemplate);
  });

  it('should set ownerProfileId to individual profile and stewardProfileId to currentProfileId', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const [userRecord] = await db
      .select()
      .from(users)
      .where(eq(users.email, setup.userEmail));

    expect(userRecord!.profileId).toBeDefined();
    expect(userRecord!.currentProfileId).toBe(setup.organization.profileId);

    const [template] = await db
      .insert(decisionProcesses)
      .values({
        name: `Owner/Steward Template ${task.id}`,
        processSchema: simpleVoting,
        createdByProfileId: userRecord!.profileId!,
      })
      .returning();

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.decision.createInstanceFromTemplate({
      templateId: template!.id,
      name: `Owner Steward Test ${task.id}`,
    });

    testData.trackProfileForCleanup(result.id);

    const instance = await db.query.processInstances.findFirst({
      where: { id: result.processInstance.id },
    });

    expect(instance!.ownerProfileId).toBe(userRecord!.profileId);
    expect(instance!.stewardProfileId).toBe(setup.organization.profileId);
  });

  it('should fall back stewardProfileId to individual profile when currentProfileId is null', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const [userRecord] = await db
      .select()
      .from(users)
      .where(eq(users.email, setup.userEmail));

    await db
      .update(users)
      .set({ currentProfileId: null })
      .where(eq(users.id, userRecord!.id));

    const [template] = await db
      .insert(decisionProcesses)
      .values({
        name: `No Org Context Template ${task.id}`,
        processSchema: simpleVoting,
        createdByProfileId: userRecord!.profileId!,
      })
      .returning();

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.decision.createInstanceFromTemplate({
      templateId: template!.id,
      name: `No Org Context Test ${task.id}`,
    });

    testData.trackProfileForCleanup(result.id);

    const instance = await db.query.processInstances.findFirst({
      where: { id: result.processInstance.id },
    });

    expect(instance!.ownerProfileId).toBe(userRecord!.profileId);
    expect(instance!.stewardProfileId).toBe(userRecord!.profileId);
  });
});
