import { type DecisionInstanceData } from '@op/common';
import { db, eq } from '@op/db/client';
import { ProcessStatus, processInstances } from '@op/db/schema';
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

describe.concurrent('updateDecisionInstance', () => {
  it('should update instance name', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const newName = `Updated Name ${task.id}`;
    const result = await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      name: newName,
    });

    expect(result.processInstance.name).toBe(newName);
    expect(result.processInstance.id).toBe(instance.instance.id);
  });

  it('should update instance description', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const newDescription = `Updated description for ${task.id}`;
    const result = await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      description: newDescription,
    });

    expect(result.processInstance.description).toBe(newDescription);
  });

  it('should update instance status to published', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      status: ProcessStatus.PUBLISHED,
    });

    expect(result.processInstance.status).toBe(ProcessStatus.PUBLISHED);
  });

  it('should update config hideBudget setting', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      config: { hideBudget: true },
    });

    // Verify the config was updated in the database
    const dbInstance = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instance.instance.id),
    });

    const instanceData = dbInstance!.instanceData as DecisionInstanceData;
    expect(instanceData.config?.hideBudget).toBe(true);
    expect(result.processInstance.id).toBe(instance.instance.id);
  });

  it('should update phase settings', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Get current phases to know which phase IDs exist
    const dbInstance = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instance.instance.id),
    });
    const currentData = dbInstance!.instanceData as DecisionInstanceData;
    const firstPhaseId = currentData.phases[0]?.phaseId;

    if (!firstPhaseId) {
      throw new Error('No phases found in instance');
    }

    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      phases: [
        {
          phaseId: firstPhaseId,
          settings: { maxProposalsPerMember: 10 },
        },
      ],
    });

    // Verify the settings were updated
    const updatedInstance = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instance.instance.id),
    });

    const instanceData = updatedInstance!.instanceData as DecisionInstanceData;

    const firstPhase = instanceData.phases.find(
      (p) => p.phaseId === firstPhaseId,
    );
    expect(firstPhase?.settings?.maxProposalsPerMember).toBe(10);
  });

  it('should update multiple fields at once', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const newName = `Multi-update ${task.id}`;
    const newDescription = `Multi-update description ${task.id}`;

    const result = await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      name: newName,
      description: newDescription,
      status: ProcessStatus.PUBLISHED,
      config: { hideBudget: true },
    });

    expect(result.processInstance.name).toBe(newName);
    expect(result.processInstance.description).toBe(newDescription);
    expect(result.processInstance.status).toBe(ProcessStatus.PUBLISHED);

    // Verify config in database
    const dbInstance = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instance.instance.id),
    });

    const instanceData = dbInstance!.instanceData as DecisionInstanceData;
    expect(instanceData.config?.hideBudget).toBe(true);
  });

  it('should not allow non-admin to update instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    // Create a member user (non-admin)
    const memberUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const nonAdminCaller = await createAuthenticatedCaller(memberUser.email);

    // Non-admin should NOT be able to update the instance
    // Note: assertAccess throws AccessControlException which may be wrapped as INTERNAL_SERVER_ERROR
    // The important thing is that the operation is denied
    await expect(
      nonAdminCaller.decision.updateDecisionInstance({
        instanceId: instance.instance.id,
        name: 'Should Fail',
      }),
    ).rejects.toThrow();
  });

  it('should require authentication', async ({ task }) => {
    const caller = createCaller({
      session: null,
      user: null,
    } as never);

    await expect(
      caller.decision.updateDecisionInstance({
        instanceId: '00000000-0000-0000-0000-000000000000',
        name: `Auth Test ${task.id}`,
      }),
    ).rejects.toThrow();
  });

  it('should return 404 for non-existent instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: true,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.updateDecisionInstance({
        instanceId: '00000000-0000-0000-0000-000000000000',
        name: `Not Found Test ${task.id}`,
      }),
    ).rejects.toThrow(/not found/i);
  });

  it('should return existing profile when no updates provided', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Call with only instanceId - no actual updates
    const result = await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
    });

    expect(result.id).toBe(instance.profileId);
    expect(result.processInstance.id).toBe(instance.instance.id);
  });

  it('should update phases on a published instance with only endDate', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Publish the instance first
    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      status: ProcessStatus.PUBLISHED,
    });

    // Get current phases
    const dbInstance = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instance.instance.id),
    });
    const currentData = dbInstance!.instanceData as DecisionInstanceData;

    // Update phases with only endDate (no startDate) — should not throw
    const endDate = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const result = await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      phases: currentData.phases.map((p) => ({
        phaseId: p.phaseId,
        endDate,
      })),
    });

    expect(result.processInstance.id).toBe(instance.instance.id);

    // Verify phases were updated in the database
    const updatedInstance = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instance.instance.id),
    });
    const updatedData = updatedInstance!.instanceData as DecisionInstanceData;
    for (const phase of updatedData.phases) {
      expect(phase.endDate).toBe(endDate);
    }
  });

  it('should accept and persist a valid proposalTemplate', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const validTemplate = {
      type: 'object',
      properties: {
        title: { type: 'string', title: 'Project Title' },
        budget: { type: 'number', minimum: 0 },
      },
      required: ['title'],
    };

    const result = await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      proposalTemplate: validTemplate,
    });

    expect(result.processInstance.id).toBe(instance.instance.id);

    const dbInstance = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
    });

    const instanceData = dbInstance!.instanceData as DecisionInstanceData;
    expect(instanceData.proposalTemplate).toBeDefined();
    expect(instanceData.proposalTemplate?.properties).toHaveProperty('title');
    expect(instanceData.proposalTemplate?.properties).toHaveProperty('budget');
  });

  it('should reject an invalid proposalTemplate and not persist it', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const beforeInstance = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
    });
    const beforeData = beforeInstance!.instanceData as DecisionInstanceData;

    // Invalid: "bogus" is not a valid JSON Schema type
    await expect(
      caller.decision.updateDecisionInstance({
        instanceId: instance.instance.id,
        proposalTemplate: { type: 'bogus' },
      }),
    ).rejects.toMatchObject({
      cause: { name: 'ValidationError' },
    });

    // Verify nothing was persisted
    const afterInstance = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
    });
    const afterData = afterInstance!.instanceData as DecisionInstanceData;
    expect(afterData.proposalTemplate).toEqual(beforeData.proposalTemplate);
  });

  it('should update phases on a published instance when some phases have no dates', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Publish the instance first
    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      status: ProcessStatus.PUBLISHED,
    });

    // Get current phases
    const dbInstance = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instance.instance.id),
    });
    const currentData = dbInstance!.instanceData as DecisionInstanceData;
    const phaseIds = currentData.phases.map((p) => p.phaseId);

    // Send phases with no dates at all — should succeed (transitions skipped)
    const result = await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      phases: phaseIds.map((phaseId) => ({
        phaseId,
        name: `Updated ${phaseId}`,
      })),
    });

    expect(result.processInstance.id).toBe(instance.instance.id);

    // Verify names were updated
    const updatedInstance = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instance.instance.id),
    });
    const updatedData = updatedInstance!.instanceData as DecisionInstanceData;
    for (const phase of updatedData.phases) {
      expect(phase.name).toBe(`Updated ${phase.phaseId}`);
    }
  });
});
