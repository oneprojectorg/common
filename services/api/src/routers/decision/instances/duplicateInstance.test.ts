import { type DecisionInstanceData, simpleVoting } from '@op/common';
import type { DecisionSchemaDefinition } from '@op/common';
import { db, eq } from '@op/db/client';
import {
  ProcessStatus,
  decisionProcesses,
  processInstances,
  users,
} from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating/decision';
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

  return {
    templateId: template!.id,
    userEmail: setup.userEmail,
    // The setup makes this user an admin of a fresh organization.
    organizationProfileId: setup.organization.profileId,
  };
}

async function createSourceInstance(
  testData: TestDecisionsDataManager,
  taskId: string,
) {
  const { templateId, userEmail, organizationProfileId } =
    await createSimpleTemplate(testData, taskId);
  const caller = await createAuthenticatedCaller(userEmail);

  const result = await caller.decision.createInstanceFromTemplate({
    templateId,
    name: `Source Instance ${taskId}`,
  });

  testData.trackProfileForCleanup(result.id);

  return { result, caller, templateId, userEmail, organizationProfileId };
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

  it('should copy phase-level rubric templates in both include.phases branches when include.reviewRubric is true', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { result: source, caller } = await createSourceInstance(
      testData,
      task.id,
    );

    const phaseRubric = {
      type: 'object' as const,
      properties: {
        viability: { type: 'integer' as const, title: 'Viability' },
      },
    };
    await caller.decision.updateDecisionInstance({
      instanceId: source.processInstance.id,
      phases: [{ phaseId: 'submission', rubricTemplate: phaseRubric }],
    });

    const fullCopy = await caller.decision.duplicateInstance({
      instanceId: source.processInstance.id,
      name: 'Phase Rubric Full Copy',
      include: ALL_INCLUDED,
    });
    testData.trackProfileForCleanup(fullCopy.id);

    const fullInstance = await db.query.processInstances.findFirst({
      where: { id: fullCopy.processInstance.id },
    });
    const fullData = fullInstance!.instanceData as DecisionInstanceData;
    expect(
      fullData.phases.find((p) => p.phaseId === 'submission')?.rubricTemplate,
    ).toMatchObject({ properties: { viability: { title: 'Viability' } } });

    // Minimal-phase branch: identity-only phases still carry the rubric.
    const minimalCopy = await caller.decision.duplicateInstance({
      instanceId: source.processInstance.id,
      name: 'Phase Rubric Minimal Copy',
      include: { ...ALL_INCLUDED, phases: false },
    });
    testData.trackProfileForCleanup(minimalCopy.id);

    const minimalInstance = await db.query.processInstances.findFirst({
      where: { id: minimalCopy.processInstance.id },
    });
    const minimalData = minimalInstance!.instanceData as DecisionInstanceData;
    const minimalPhase = minimalData.phases.find(
      (p) => p.phaseId === 'submission',
    );
    expect(minimalPhase?.rubricTemplate).toMatchObject({
      properties: { viability: { title: 'Viability' } },
    });
    expect(minimalPhase?.rules).toBeUndefined();
  });

  it('should not copy phase-level rubric templates when include.reviewRubric is false', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { result: source, caller } = await createSourceInstance(
      testData,
      task.id,
    );

    await caller.decision.updateDecisionInstance({
      instanceId: source.processInstance.id,
      phases: [
        {
          phaseId: 'submission',
          rubricTemplate: {
            type: 'object',
            properties: {
              viability: { type: 'integer', title: 'Viability' },
            },
          },
        },
      ],
    });

    const duplicate = await caller.decision.duplicateInstance({
      instanceId: source.processInstance.id,
      name: 'No Phase Rubric Test',
      include: { ...ALL_INCLUDED, reviewRubric: false },
    });
    testData.trackProfileForCleanup(duplicate.id);

    const instance = await db.query.processInstances.findFirst({
      where: { id: duplicate.processInstance.id },
    });
    const instanceData = instance!.instanceData as DecisionInstanceData;
    for (const phase of instanceData.phases) {
      expect(phase.rubricTemplate).toBeUndefined();
    }
  });

  // The reported bug was a duplicate arriving with an empty rubric, and that
  // rubric lives at the instance level, not on a phase.
  it('should copy the instance-level rubric when include.reviewRubric is true', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { result: source, caller } = await createSourceInstance(
      testData,
      task.id,
    );

    const rubric = {
      type: 'object' as const,
      properties: {
        impact: { type: 'integer' as const, title: 'Impact', maximum: 5 },
        feasibility: {
          type: 'integer' as const,
          title: 'Feasibility',
          maximum: 3,
        },
        notes: { type: 'string' as const, title: 'Notes' },
      },
      required: ['impact', 'feasibility'],
    };

    await caller.decision.updateDecisionInstance({
      instanceId: source.processInstance.id,
      rubricTemplate: rubric,
    });

    const duplicate = await caller.decision.duplicateInstance({
      instanceId: source.processInstance.id,
      name: `Instance Rubric Copy ${task.id}`,
      include: ALL_INCLUDED,
    });
    testData.trackProfileForCleanup(duplicate.id);

    const instance = await db.query.processInstances.findFirst({
      where: { id: duplicate.processInstance.id },
    });
    const instanceData = instance!.instanceData as DecisionInstanceData;

    // Whole schema, not just presence — a rubric that loses its criteria,
    // their scoring maxima, or its required list is the same bug.
    expect(instanceData.rubricTemplate).toEqual(rubric);
  });

  it('should not copy the instance-level rubric when include.reviewRubric is false', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { result: source, caller } = await createSourceInstance(
      testData,
      task.id,
    );

    await caller.decision.updateDecisionInstance({
      instanceId: source.processInstance.id,
      rubricTemplate: {
        type: 'object',
        properties: { impact: { type: 'integer', title: 'Impact' } },
      },
    });

    const duplicate = await caller.decision.duplicateInstance({
      instanceId: source.processInstance.id,
      name: `No Instance Rubric ${task.id}`,
      include: { ...ALL_INCLUDED, reviewRubric: false },
    });
    testData.trackProfileForCleanup(duplicate.id);

    const instance = await db.query.processInstances.findFirst({
      where: { id: duplicate.processInstance.id },
    });
    const instanceData = instance!.instanceData as DecisionInstanceData;

    expect(instanceData.rubricTemplate).toBeUndefined();
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
    ).rejects.toThrow(/not authorized/i);
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

  it('should default both ownerProfileId and stewardProfileId to the duplicating individual when steward not provided', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const {
      result: source,
      caller,
      userEmail,
    } = await createSourceInstance(testData, task.id);

    const [userRecord] = await db
      .select()
      .from(users)
      .where(eq(users.email, userEmail));

    expect(userRecord!.profileId).toBeDefined();
    expect(userRecord!.currentProfileId).toBeDefined();
    expect(userRecord!.currentProfileId).not.toBe(userRecord!.profileId);

    const duplicate = await caller.decision.duplicateInstance({
      instanceId: source.processInstance.id,
      name: `Default Steward Test ${task.id}`,
      include: ALL_INCLUDED,
    });

    testData.trackProfileForCleanup(duplicate.id);

    const instance = await db.query.processInstances.findFirst({
      where: { id: duplicate.processInstance.id },
    });

    expect(instance!.ownerProfileId).toBe(userRecord!.profileId);
    expect(instance!.stewardProfileId).toBe(userRecord!.profileId);
  });

  it('should list the duplicate under the duplicating user own process list', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const {
      result: source,
      caller,
      userEmail,
    } = await createSourceInstance(testData, task.id);

    const [userRecord] = await db
      .select()
      .from(users)
      .where(eq(users.email, userEmail));

    const duplicateName = `Listed Duplicate ${task.id}`;
    const duplicate = await caller.decision.duplicateInstance({
      instanceId: source.processInstance.id,
      name: duplicateName,
      include: ALL_INCLUDED,
    });

    testData.trackProfileForCleanup(duplicate.id);

    const listed = await caller.decision.listDecisionProfiles({
      stewardProfileId: userRecord!.profileId!,
      status: [ProcessStatus.DRAFT],
    });

    expect(listed.items.map((item) => item.id)).toContain(duplicate.id);
  });

  it('should reject a steward profile the caller does not administer', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { result: source, caller } = await createSourceInstance(
      testData,
      task.id,
    );

    const otherSetup = await testData.createDecisionSetup({ instanceCount: 0 });
    const [otherUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, otherSetup.userEmail));

    await expect(
      caller.decision.duplicateInstance({
        instanceId: source.processInstance.id,
        name: `Foreign Steward ${task.id}`,
        stewardProfileId: otherUser!.profileId!,
        include: ALL_INCLUDED,
      }),
    ).rejects.toThrow(/steward/i);
  });

  it('should accept an org profile the caller administers as steward', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const {
      result: source,
      caller,
      organizationProfileId,
    } = await createSourceInstance(testData, task.id);

    // Org grants live on organizationUsers, so a profileUsers-only admin check
    // would reject this.
    const duplicate = await caller.decision.duplicateInstance({
      instanceId: source.processInstance.id,
      name: `Org Steward Copy ${task.id}`,
      stewardProfileId: organizationProfileId,
      include: ALL_INCLUDED,
    });
    testData.trackProfileForCleanup(duplicate.id);

    const instance = await db.query.processInstances.findFirst({
      where: { id: duplicate.processInstance.id },
    });

    expect(instance!.stewardProfileId).toBe(organizationProfileId);
  });

  it('should carry every instanceData field the source has when all includes are on', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { result: source, caller } = await createSourceInstance(
      testData,
      task.id,
    );

    // Populate every DecisionInstanceData field the API can set.
    await caller.decision.updateDecisionInstance({
      instanceId: source.processInstance.id,
      // No `categories` — they create global taxonomy terms this test would
      // have to clean up, and config is copied wholesale, so any key proves it.
      config: { hideBudget: true, requireCategorySelection: true },
      overview: {
        headline: 'Cycle 1 headline',
        description: 'Cycle 1 overview description',
      },
      phases: [{ phaseId: 'submission', name: 'Submission' }],
      proposalTemplate: {
        type: 'object',
        properties: { title: { type: 'string', title: 'Title' } },
      },
      rubricTemplate: {
        type: 'object',
        properties: {
          impact: { type: 'integer', title: 'Impact', maximum: 5 },
        },
      },
    });

    // `fieldValues` has no update endpoint and `heroImage` is deliberately
    // rejected by the generic update, so seed both straight onto the row.
    const seeded = await db.query.processInstances.findFirst({
      where: { id: source.processInstance.id },
    });
    const seededData = seeded!.instanceData as DecisionInstanceData;
    await db
      .update(processInstances)
      .set({
        instanceData: {
          ...seededData,
          fieldValues: { proposalInfoTitle: 'How to apply' },
          overview: {
            ...seededData.overview,
            heroImage: `${source.processInstance.id}/overview/banner.png`,
          },
        },
      })
      .where(eq(processInstances.id, source.processInstance.id));

    const sourceRow = await db.query.processInstances.findFirst({
      where: { id: source.processInstance.id },
    });
    const sourceData = sourceRow!.instanceData as DecisionInstanceData;

    const duplicate = await caller.decision.duplicateInstance({
      instanceId: source.processInstance.id,
      name: `Full Copy ${task.id}`,
      include: ALL_INCLUDED,
    });
    testData.trackProfileForCleanup(duplicate.id);

    const duplicateRow = await db.query.processInstances.findFirst({
      where: { id: duplicate.processInstance.id },
    });
    const duplicateData = duplicateRow!.instanceData as DecisionInstanceData;

    // A new DecisionInstanceData field that buildInstanceData forgets fails
    // here. If one is meant not to carry, subtract it with the reason rather
    // than dropping the assertion.
    expect(Object.keys(duplicateData).sort()).toEqual(
      Object.keys(sourceData).sort(),
    );

    expect(duplicateData.rubricTemplate).toEqual(sourceData.rubricTemplate);
    expect(duplicateData.proposalTemplate).toEqual(sourceData.proposalTemplate);
    expect(duplicateData.config).toEqual(sourceData.config);
    expect(duplicateData.fieldValues).toEqual(sourceData.fieldValues);
    expect(duplicateData.overview).toMatchObject({
      headline: 'Cycle 1 headline',
      description: 'Cycle 1 overview description',
    });
    // Shared storage object; see buildInstanceData.
    expect(duplicateData.overview?.heroImage).toBeUndefined();
  });

  it('should not copy overview or fieldValues when include.processSettings is false', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { result: source, caller } = await createSourceInstance(
      testData,
      task.id,
    );

    await caller.decision.updateDecisionInstance({
      instanceId: source.processInstance.id,
      overview: { headline: 'Should not carry' },
    });

    const seeded = await db.query.processInstances.findFirst({
      where: { id: source.processInstance.id },
    });
    await db
      .update(processInstances)
      .set({
        instanceData: {
          ...(seeded!.instanceData as DecisionInstanceData),
          fieldValues: { proposalInfoTitle: 'Should not carry' },
        },
      })
      .where(eq(processInstances.id, source.processInstance.id));

    const duplicate = await caller.decision.duplicateInstance({
      instanceId: source.processInstance.id,
      name: `No Settings Copy ${task.id}`,
      include: { ...ALL_INCLUDED, processSettings: false },
    });
    testData.trackProfileForCleanup(duplicate.id);

    const duplicateRow = await db.query.processInstances.findFirst({
      where: { id: duplicate.processInstance.id },
    });
    const duplicateData = duplicateRow!.instanceData as DecisionInstanceData;

    expect(duplicateData.overview).toBeUndefined();
    expect(duplicateData.fieldValues).toBeUndefined();
  });
});

describeDecisionAccessTierGating('duplicateInstance', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.duplicateInstance({
          instanceId: instance.instance.id,
          name: 'no-JWT copy',
          include: {
            processSettings: false,
            phases: false,
            proposalCategories: false,
            proposalTemplate: false,
            reviewSettings: false,
            reviewRubric: false,
            roles: false,
          },
        }),
        'none',
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'rejects anon-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.anonJwt();

      await expectFailsAccessTierGate(
        caller.decision.duplicateInstance({
          instanceId: instance.instance.id,
          name: 'anon copy',
          include: {
            processSettings: false,
            phases: false,
            proposalCategories: false,
            proposalTemplate: false,
            reviewSettings: false,
            reviewRubric: false,
            roles: false,
          },
        }),
        'anon',
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'admits user-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.userJwt();

      await expectPassesAccessTierGate(
        caller.decision.duplicateInstance({
          instanceId: instance.instance.id,
          name: 'anon copy',
          include: {
            processSettings: false,
            phases: false,
            proposalCategories: false,
            proposalTemplate: false,
            reviewSettings: false,
            reviewRubric: false,
            roles: false,
          },
        }),
      );
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.networkJwt(setup.userEmail);

      const result = await caller.decision.duplicateInstance({
        instanceId: instance.instance.id,
        name: `Common-JWT copy ${task.id}`,
        include: {
          processSettings: true,
          phases: true,
          proposalCategories: true,
          proposalTemplate: true,
          reviewSettings: true,
          reviewRubric: true,
          roles: true,
        },
      });
      expect(result.id).toBeDefined();
      testData.trackProfileForCleanup(result.id);
    },
  ),
});
