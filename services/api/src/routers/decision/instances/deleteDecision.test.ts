import { db } from '@op/db/client';
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

describe.concurrent('deleteDecision', () => {
  it('should delete a decision as the owner', async ({
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

    const result = await caller.decision.deleteDecision({
      instanceId: instance.instance.id,
    });

    expect(result.success).toBe(true);
    expect(result.deletedId).toBe(instance.instance.id);

    // Verify the instance is gone from DB
    const deletedInstance = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
    });
    expect(deletedInstance).toBeUndefined();

    // Verify the profile is also gone (cascade)
    const deletedProfile = await db.query.profiles.findFirst({
      where: { id: instance.profileId },
    });
    expect(deletedProfile).toBeUndefined();
  });

  it('should allow a non-owner admin to delete a decision', async ({
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

    // Create a second user and grant them admin access on the instance profile
    const adminUser = await testData.createMemberUser({
      organization: setup.organization,
    });

    await testData.grantProfileAccess(
      instance.profileId,
      adminUser.authUserId,
      adminUser.email,
      true,
    );

    const adminCaller = await createAuthenticatedCaller(adminUser.email);

    const result = await adminCaller.decision.deleteDecision({
      instanceId: instance.instance.id,
    });

    expect(result.success).toBe(true);
    expect(result.deletedId).toBe(instance.instance.id);

    // Verify the instance is gone from DB
    const deletedInstance = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
    });
    expect(deletedInstance).toBeUndefined();
  });

  it('should not allow a non-admin member to delete a decision', async ({
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

    // Create a member user (non-admin) with access to the instance
    const memberUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const memberCaller = await createAuthenticatedCaller(memberUser.email);

    await expect(
      memberCaller.decision.deleteDecision({
        instanceId: instance.instance.id,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });

    // Verify the instance still exists
    const existingInstance = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
    });
    expect(existingInstance).toBeDefined();
  });

  it('should not allow a user without any access to delete a decision', async ({
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

    // Create a completely separate user with no access
    const otherSetup = await testData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: false,
    });

    const otherCaller = await createAuthenticatedCaller(otherSetup.userEmail);

    await expect(
      otherCaller.decision.deleteDecision({
        instanceId: instance.instance.id,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
  });

  it('should return not found for non-existent instance', async ({
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
      caller.decision.deleteDecision({
        instanceId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toThrow(/not found/i);
  });

  it('should require authentication', async () => {
    const caller = createCaller({
      session: null,
      user: null,
    } as never);

    await expect(
      caller.decision.deleteDecision({
        instanceId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toThrow();
  });
});
