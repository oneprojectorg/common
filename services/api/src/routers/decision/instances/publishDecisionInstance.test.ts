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

describe.concurrent('publishDecisionInstance', () => {
  it('should promote draftInstanceData to live columns', async ({
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

    const newName = `Promoted Name ${task.id}`;
    const newDescription = `Promoted Description ${task.id}`;
    await caller.decision.updateDraftInstanceData({
      instanceId: instance.instance.id,
      name: newName,
      description: newDescription,
      config: { hideBudget: true },
    });

    // Promote draftInstanceData to live columns (no status change)
    const result = await caller.decision.publishDecisionInstance({
      instanceId: instance.instance.id,
    });

    // Verify live columns were updated
    expect(result.processInstance.name).toBe(newName);
    expect(result.processInstance.description).toBe(newDescription);

    // Verify instanceData.config was updated
    const dbInstance = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instance.instance.id),
    });
    const instanceData = dbInstance!.instanceData as DecisionInstanceData;
    expect(instanceData.config?.hideBudget).toBe(true);
  });

  it('should generate slug when publishing a draft', async ({
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

    const newName = `My Process ${task.id}`;
    await caller.decision.updateDraftInstanceData({
      instanceId: instance.instance.id,
      name: newName,
    });

    // Promote with PUBLISHED status
    const result = await caller.decision.publishDecisionInstance({
      instanceId: instance.instance.id,
      status: ProcessStatus.PUBLISHED,
    });

    // Slug should contain the slugified name
    expect(result.slug).toContain('decision-my-process');
    expect(result.processInstance.status).toBe(ProcessStatus.PUBLISHED);
  });

  it('should not change slug when promoting an already-published instance', async ({
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

    // First promote to PUBLISHED (generates slug)
    const published = await caller.decision.publishDecisionInstance({
      instanceId: instance.instance.id,
      status: ProcessStatus.PUBLISHED,
    });
    const slugAfterPublish = published.slug;

    // Update draftInstanceData with a new name
    const newName = `Renamed After Publish ${task.id}`;
    await caller.decision.updateDraftInstanceData({
      instanceId: instance.instance.id,
      name: newName,
    });

    // Promote again without status change
    const promoted = await caller.decision.publishDecisionInstance({
      instanceId: instance.instance.id,
    });

    // Slug should stay the same
    expect(promoted.slug).toBe(slugAfterPublish);

    // But the live name should have been updated
    expect(promoted.processInstance.name).toBe(newName);
  });

  it('should preserve runtime fields in instanceData', async ({
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

    // Read original instanceData to capture runtime fields
    const dbBefore = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instance.instance.id),
    });
    const dataBefore = dbBefore!.instanceData as DecisionInstanceData;

    // Save some changes to draftInstanceData
    await caller.decision.updateDraftInstanceData({
      instanceId: instance.instance.id,
      name: `Runtime Test ${task.id}`,
      config: { hideBudget: true },
    });

    // Promote
    await caller.decision.publishDecisionInstance({
      instanceId: instance.instance.id,
    });

    // Read instanceData after promotion
    const dbAfter = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instance.instance.id),
    });
    const dataAfter = dbAfter!.instanceData as DecisionInstanceData;

    // Template fields should be preserved
    expect(dataAfter.templateId).toBe(dataBefore.templateId);
    expect(dataAfter.templateVersion).toBe(dataBefore.templateVersion);
    expect(dataAfter.templateName).toBe(dataBefore.templateName);
    expect(dataAfter.templateDescription).toBe(dataBefore.templateDescription);

    // The config update should still be applied
    expect(dataAfter.config?.hideBudget).toBe(true);
  });

  it('should reject promotion for completed instances', async ({
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
    await caller.decision.publishDecisionInstance({
      instanceId: instance.instance.id,
      status: ProcessStatus.PUBLISHED,
    });

    // Set status to COMPLETED
    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      status: ProcessStatus.COMPLETED,
    });

    // Attempting to promote a completed instance should fail
    await expect(
      caller.decision.publishDecisionInstance({
        instanceId: instance.instance.id,
      }),
    ).rejects.toThrow(
      'Cannot promote draft instance data for a completed or cancelled process',
    );
  });

  it('should reject promotion for cancelled instances', async ({
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
    await caller.decision.publishDecisionInstance({
      instanceId: instance.instance.id,
      status: ProcessStatus.PUBLISHED,
    });

    // Set status to CANCELLED
    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      status: ProcessStatus.CANCELLED,
    });

    // Attempting to promote a cancelled instance should fail
    await expect(
      caller.decision.publishDecisionInstance({
        instanceId: instance.instance.id,
      }),
    ).rejects.toThrow(
      'Cannot promote draft instance data for a completed or cancelled process',
    );
  });

  it('should not allow non-admin to promote', async ({
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

    // Non-admin should NOT be able to promote
    await expect(
      nonAdminCaller.decision.publishDecisionInstance({
        instanceId: instance.instance.id,
      }),
    ).rejects.toThrow();
  });
});
