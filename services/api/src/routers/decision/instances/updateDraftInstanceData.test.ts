import { db, eq } from '@op/db/client';
import { processInstances } from '@op/db/schema';
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

describe.concurrent('updateDraftInstanceData', () => {
  it('should write to draftInstanceData without touching live columns', async ({
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
    const instanceId = instance.instance.id;

    // Record live columns before the update
    const before = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instanceId),
    });
    const liveNameBefore = before!.name;
    const liveDescriptionBefore = before!.description;

    const newName = `Draft Name ${task.id}`;
    const newDescription = `Draft Description ${task.id}`;
    await caller.decision.updateDraftInstanceData({
      instanceId,
      name: newName,
      description: newDescription,
    });

    const after = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instanceId),
    });

    // Live columns should be unchanged
    expect(after!.name).toBe(liveNameBefore);
    expect(after!.description).toBe(liveDescriptionBefore);

    // Draft column should have the new values
    const draft = after!.draftInstanceData as Record<string, unknown>;
    expect(draft.name).toBe(newName);
    expect(draft.description).toBe(newDescription);
  });

  it('should merge config into existing draft', async ({
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
    const instanceId = instance.instance.id;

    // First update: set hideBudget
    await caller.decision.updateDraftInstanceData({
      instanceId,
      config: { hideBudget: true },
    });

    // Second update: set isPrivate (should merge, not replace)
    await caller.decision.updateDraftInstanceData({
      instanceId,
      config: { isPrivate: true },
    });

    const dbInstance = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instanceId),
    });

    const draft = dbInstance!.draftInstanceData as Record<string, unknown>;
    const config = draft.config as Record<string, unknown>;
    expect(config.hideBudget).toBe(true);
    expect(config.isPrivate).toBe(true);
  });

  it('should update phases in draft', async ({ task, onTestFinished }) => {
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
    const instanceId = instance.instance.id;

    const endDate = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    await caller.decision.updateDraftInstanceData({
      instanceId,
      phases: [
        {
          phaseId: 'initial',
          endDate,
        },
      ],
    });

    const dbInstance = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instanceId),
    });

    const draft = dbInstance!.draftInstanceData as Record<string, unknown>;
    const phases = draft.phases as Array<Record<string, unknown>>;
    expect(phases).toHaveLength(1);
    expect(phases[0]!.endDate).toBe(endDate);

    // Live instanceData phases should be unchanged
    const live = dbInstance!.instanceData as Record<string, unknown>;
    const livePhases = live.phases as Array<Record<string, unknown>>;
    expect(livePhases[0]!.endDate).not.toBe(endDate);
  });

  it('should reject non-admin users', async ({ task, onTestFinished }) => {
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

    await expect(
      nonAdminCaller.decision.updateDraftInstanceData({
        instanceId: instance.instance.id,
        name: 'Should fail',
      }),
    ).rejects.toThrow();
  });

  it('should throw on malformed existing draftInstanceData', async ({
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
    const instanceId = instance.instance.id;

    // Corrupt the draftInstanceData column directly
    await db
      .update(processInstances)
      .set({ draftInstanceData: 'not-an-object' })
      .where(eq(processInstances.id, instanceId));

    await expect(
      caller.decision.updateDraftInstanceData({
        instanceId,
        name: 'Should fail',
      }),
    ).rejects.toThrow('malformed');
  });
});
