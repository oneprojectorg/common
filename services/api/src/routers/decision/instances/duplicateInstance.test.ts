import { type DecisionInstanceData, simpleVoting } from '@op/common';
import type { DecisionSchemaDefinition } from '@op/common';
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

const ALL_INCLUDED = {
  processSettings: true,
  phases: true,
  proposalCategories: true,
  proposalTemplate: true,
  reviewSettings: true,
  reviewRubric: true,
  roles: true,
};

const NONE_INCLUDED = {
  processSettings: false,
  phases: false,
  proposalCategories: false,
  proposalTemplate: false,
  reviewSettings: false,
  reviewRubric: false,
  roles: false,
};

async function createSimpleTemplate(
  testData: TestDecisionsDataManager,
  taskId: string,
  schemaOverrides?: Partial<DecisionSchemaDefinition>,
) {
  const schema: DecisionSchemaDefinition = {
    ...simpleVoting,
    ...schemaOverrides,
  };

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
      description: schema.description,
      processSchema: schema,
      createdByProfileId: userRecord.profileId,
    })
    .returning();

  return { templateId: template!.id, userEmail: setup.userEmail };
}

async function createSourceInstance(
  testData: TestDecisionsDataManager,
  taskId: string,
) {
  const { templateId, userEmail } = await createSimpleTemplate(
    testData,
    taskId,
  );
  const caller = await createAuthenticatedCaller(userEmail);

  const result = await caller.decision.createInstanceFromTemplate({
    templateId,
    name: `Source Instance ${taskId}`,
  });

  testData.trackProfileForCleanup(result.id);

  return { result, caller, templateId, userEmail };
}

describe.concurrent('duplicateInstance', () => {
  it('should duplicate an instance with all includes', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { result: source, caller } = await createSourceInstance(
      testData,
      task.id,
    );

    const duplicate = await caller.decision.duplicateInstance({
      instanceId: source.processInstance.id,
      name: `Duplicate of ${source.name}`,
      include: ALL_INCLUDED,
    });

    testData.trackProfileForCleanup(duplicate.id);

    expect(duplicate.name).toBe(`Duplicate of ${source.name}`);
    expect(duplicate.processInstance.status).toBe('draft');
    expect(duplicate.id).not.toBe(source.id);
    expect(duplicate.processInstance.id).not.toBe(source.processInstance.id);

    // Verify instanceData was copied
    const instance = await db.query.processInstances.findFirst({
      where: { id: duplicate.processInstance.id },
    });
    const instanceData = instance!.instanceData as DecisionInstanceData;

    expect(instanceData.phases.length).toBeGreaterThan(0);
    expect(instanceData.templateId).toBe(simpleVoting.id);
  });

  it('should create a new profile with a unique slug', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { result: source, caller } = await createSourceInstance(
      testData,
      task.id,
    );

    const duplicate = await caller.decision.duplicateInstance({
      instanceId: source.processInstance.id,
      name: 'Duplicate Test',
      include: ALL_INCLUDED,
    });

    testData.trackProfileForCleanup(duplicate.id);

    expect(duplicate.slug).toBeDefined();
    expect(duplicate.slug).not.toBe(source.slug);
  });

  it('should create new default roles for the duplicated instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { result: source, caller } = await createSourceInstance(
      testData,
      task.id,
    );

    const duplicate = await caller.decision.duplicateInstance({
      instanceId: source.processInstance.id,
      name: 'Roles Test',
      include: ALL_INCLUDED,
    });

    testData.trackProfileForCleanup(duplicate.id);

    // Verify new roles were created (not shared with source)
    const duplicateRoles = await db.query.accessRoles.findMany({
      where: { profileId: duplicate.id },
    });

    const sourceRoles = await db.query.accessRoles.findMany({
      where: { profileId: source.id },
    });

    const duplicateRoleNames = duplicateRoles.map((r) => r.name).sort();
    expect(duplicateRoleNames).toContain('Admin');
    expect(duplicateRoleNames).toContain('Participant');

    // Role IDs must be different (new records, not shared)
    const duplicateRoleIds = new Set(duplicateRoles.map((r) => r.id));
    const sourceRoleIds = new Set(sourceRoles.map((r) => r.id));
    for (const id of duplicateRoleIds) {
      expect(sourceRoleIds.has(id)).toBe(false);
    }
  });

  it('should copy phases with dates stripped when include.phases is true', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { result: source, caller } = await createSourceInstance(
      testData,
      task.id,
    );

    // Set dates on the source instance phases
    await caller.decision.updateDecisionInstance({
      instanceId: source.processInstance.id,
      phases: [
        {
          phaseId: 'submission',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
    });

    const duplicate = await caller.decision.duplicateInstance({
      instanceId: source.processInstance.id,
      name: 'Phases Test',
      include: ALL_INCLUDED,
    });

    testData.trackProfileForCleanup(duplicate.id);

    const instance = await db.query.processInstances.findFirst({
      where: { id: duplicate.processInstance.id },
    });
    const instanceData = instance!.instanceData as DecisionInstanceData;

    expect(instanceData.phases.length).toBeGreaterThan(0);
    // Dates should be stripped
    for (const phase of instanceData.phases) {
      expect(phase.startDate).toBeUndefined();
      expect(phase.endDate).toBeUndefined();
    }
  });

  it('should copy minimal phases when include.phases is false', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { result: source, caller } = await createSourceInstance(
      testData,
      task.id,
    );

    const duplicate = await caller.decision.duplicateInstance({
      instanceId: source.processInstance.id,
      name: 'No Phases Test',
      include: { ...ALL_INCLUDED, phases: false },
    });

    testData.trackProfileForCleanup(duplicate.id);

    const instance = await db.query.processInstances.findFirst({
      where: { id: duplicate.processInstance.id },
    });
    const instanceData = instance!.instanceData as DecisionInstanceData;

    // Should still have phases (minimal identity only)
    expect(instanceData.phases.length).toBeGreaterThan(0);
    // But no detailed settings
    for (const phase of instanceData.phases) {
      expect(phase.phaseId).toBeDefined();
      expect(phase.name).toBeDefined();
      expect(phase.settingsSchema).toBeUndefined();
      expect(phase.selectionPipeline).toBeUndefined();
    }
  });

  it('should not copy proposalTemplate when include.proposalTemplate is false', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { templateId, userEmail } = await createSimpleTemplate(
      testData,
      task.id,
      {
        proposalTemplate: {
          type: 'object',
          required: ['title'],
          properties: {
            title: { type: 'string', title: 'Title' },
          },
        },
      },
    );
    const caller = await createAuthenticatedCaller(userEmail);

    const source = await caller.decision.createInstanceFromTemplate({
      templateId,
      name: `Source ${task.id}`,
    });
    testData.trackProfileForCleanup(source.id);

    const duplicate = await caller.decision.duplicateInstance({
      instanceId: source.processInstance.id,
      name: 'No Template Test',
      include: { ...ALL_INCLUDED, proposalTemplate: false },
    });

    testData.trackProfileForCleanup(duplicate.id);

    const instance = await db.query.processInstances.findFirst({
      where: { id: duplicate.processInstance.id },
    });
    const instanceData = instance!.instanceData as DecisionInstanceData;

    expect(instanceData.proposalTemplate).toBeUndefined();
  });

  it('should copy description from source instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { result: source, caller } = await createSourceInstance(
      testData,
      task.id,
    );

    // Set description on source
    await caller.decision.updateDecisionInstance({
      instanceId: source.processInstance.id,
      description: 'Test description to copy',
    });

    const duplicate = await caller.decision.duplicateInstance({
      instanceId: source.processInstance.id,
      name: 'Description Test',
      include: ALL_INCLUDED,
    });

    testData.trackProfileForCleanup(duplicate.id);

    const instance = await db.query.processInstances.findFirst({
      where: { id: duplicate.processInstance.id },
    });

    expect(instance!.description).toBe('Test description to copy');
  });

  it('should set name on both profile and processInstance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { result: source, caller } = await createSourceInstance(
      testData,
      task.id,
    );

    const duplicateName = `My Duplicate ${task.id}`;
    const duplicate = await caller.decision.duplicateInstance({
      instanceId: source.processInstance.id,
      name: duplicateName,
      include: ALL_INCLUDED,
    });

    testData.trackProfileForCleanup(duplicate.id);

    // Profile name should match
    expect(duplicate.name).toBe(duplicateName);

    // processInstance.name should also match
    const instance = await db.query.processInstances.findFirst({
      where: { id: duplicate.processInstance.id },
    });
    expect(instance!.name).toBe(duplicateName);
  });

  it('should set stewardProfileId when provided', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const {
      result: source,
      caller,
      userEmail,
    } = await createSourceInstance(testData, task.id);

    // Get the caller's profile ID to pass as steward
    const [userRecord] = await db
      .select()
      .from(users)
      .where(eq(users.email, userEmail));

    const duplicate = await caller.decision.duplicateInstance({
      instanceId: source.processInstance.id,
      name: 'Steward Test',
      stewardProfileId: userRecord!.profileId!,
      include: ALL_INCLUDED,
    });

    testData.trackProfileForCleanup(duplicate.id);

    const instance = await db.query.processInstances.findFirst({
      where: { id: duplicate.processInstance.id },
    });

    expect(instance!.stewardProfileId).toBe(userRecord!.profileId);
  });

  it('should preserve the same processId as the source', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { result: source, caller } = await createSourceInstance(
      testData,
      task.id,
    );

    const duplicate = await caller.decision.duplicateInstance({
      instanceId: source.processInstance.id,
      name: 'ProcessId Test',
      include: ALL_INCLUDED,
    });

    testData.trackProfileForCleanup(duplicate.id);

    const [sourceInstance, duplicateInstance] = await Promise.all([
      db.query.processInstances.findFirst({
        where: { id: source.processInstance.id },
      }),
      db.query.processInstances.findFirst({
        where: { id: duplicate.processInstance.id },
      }),
    ]);

    expect(duplicateInstance!.processId).toBe(sourceInstance!.processId);
  });

  it('should reject duplication by non-admin user', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { result: source } = await createSourceInstance(testData, task.id);

    // Create a different user who is not an admin on the source instance
    const otherSetup = await testData.createDecisionSetup({
      instanceCount: 0,
    });
    const otherCaller = await createAuthenticatedCaller(otherSetup.userEmail);

    await expect(
      otherCaller.decision.duplicateInstance({
        instanceId: source.processInstance.id,
        name: 'Should Fail',
        include: ALL_INCLUDED,
      }),
    ).rejects.toThrow(/not authenticated/i);
  });

  it('should return not found for non-existent instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.duplicateInstance({
        instanceId: '00000000-0000-0000-0000-000000000000',
        name: 'Should Fail',
        include: ALL_INCLUDED,
      }),
    ).rejects.toThrow(/not found/i);
  });

  it('should preserve rubric template and review settings when duplicating', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { result: source, caller } = await createSourceInstance(
      testData,
      task.id,
    );

    const rubricTemplate = {
      type: 'object' as const,
      properties: {
        quality: {
          type: 'integer',
          title: 'Quality',
          'x-format': 'dropdown',
          minimum: 1,
          maximum: 5,
          oneOf: [
            { const: 1, title: 'Poor' },
            { const: 2, title: 'Fair' },
            { const: 3, title: 'Good' },
            { const: 4, title: 'Very Good' },
            { const: 5, title: 'Excellent' },
          ],
        },
      },
      'x-field-order': ['quality'],
      required: ['quality'],
    };

    // Add rubric and enable review on the review phase
    await caller.decision.updateDecisionInstance({
      instanceId: source.processInstance.id,
      rubricTemplate,
      phases: [
        {
          phaseId: 'submission',
          name: 'Proposal Submission',
          headline: 'Submit proposals',
          description: 'Members submit proposals for consideration.',
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          phaseId: 'review',
          name: 'Review & Shortlist',
          headline: 'Review proposals',
          description: 'Reviewers evaluate and shortlist proposals.',
          endDate: new Date(
            Date.now() + 14 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          rules: {
            proposals: { submit: false, review: true },
            voting: { submit: false },
            advancement: { method: 'date' as const },
          },
        },
        {
          phaseId: 'voting',
          name: 'Voting',
          headline: 'Vote on proposals',
          description: 'Members vote on shortlisted proposals.',
          endDate: new Date(
            Date.now() + 21 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
        {
          phaseId: 'results',
          name: 'Results',
          headline: 'View results',
          description: 'View final results and winning proposals.',
          endDate: new Date(
            Date.now() + 28 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
      ],
    });

    // Verify source has rubric and review enabled
    const sourceInstance = await db.query.processInstances.findFirst({
      where: { id: source.processInstance.id },
    });
    const sourceData = sourceInstance!.instanceData as DecisionInstanceData;
    expect(sourceData.rubricTemplate).toBeDefined();
    expect(
      sourceData.phases.some((p) => p.rules?.proposals?.review === true),
    ).toBe(true);

    // Duplicate with all includes
    const duplicate = await caller.decision.duplicateInstance({
      instanceId: source.processInstance.id,
      name: 'Rubric Duplicate',
      include: ALL_INCLUDED,
    });

    testData.trackProfileForCleanup(duplicate.id);

    const dupInstance = await db.query.processInstances.findFirst({
      where: { id: duplicate.processInstance.id },
    });
    const dupData = dupInstance!.instanceData as DecisionInstanceData;

    // Rubric template must be preserved with criteria
    expect(dupData.rubricTemplate).toBeDefined();
    expect(dupData.rubricTemplate!['x-field-order']).toEqual(['quality']);
    expect(dupData.rubricTemplate!.properties).toBeDefined();
    expect(dupData.rubricTemplate!.properties!.quality).toBeDefined();
    expect(dupData.rubricTemplate!.properties!.quality.title).toBe('Quality');

    // Review settings must be preserved
    const reviewPhase = dupData.phases.find((p) => p.phaseId === 'review');
    expect(reviewPhase?.rules?.proposals?.review).toBe(true);
  });

  it('should duplicate with no includes and still have valid structure', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { result: source, caller } = await createSourceInstance(
      testData,
      task.id,
    );

    const duplicate = await caller.decision.duplicateInstance({
      instanceId: source.processInstance.id,
      name: 'Bare Duplicate',
      include: NONE_INCLUDED,
    });

    testData.trackProfileForCleanup(duplicate.id);

    const instance = await db.query.processInstances.findFirst({
      where: { id: duplicate.processInstance.id },
    });
    const instanceData = instance!.instanceData as DecisionInstanceData;

    expect(duplicate.processInstance.status).toBe('draft');
    // Should still have template metadata
    expect(instanceData.templateId).toBe(simpleVoting.id);
    // Should still have minimal phases
    expect(instanceData.phases.length).toBeGreaterThan(0);
    // Should NOT have config, proposalTemplate, or rubricTemplate
    expect(instanceData.config).toBeUndefined();
    expect(instanceData.proposalTemplate).toBeUndefined();
    expect(instanceData.rubricTemplate).toBeUndefined();
  });
});
