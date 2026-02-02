import { db, eq } from '@op/db/client';
import {
  ProcessStatus,
  processInstances,
  stateTransitionHistory,
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

describe.concurrent('deleteInstance', () => {
  it('should hard delete instance when no transitions exist', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const { instance } = setup.instances[0]!;
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.deleteInstance({
      instanceId: instance.id,
    });

    expect(result.success).toBe(true);
    expect(result.action).toBe('deleted');
    expect(result.instanceId).toBe(instance.id);

    // Verify the instance was actually deleted
    const deletedInstance = await db._query.processInstances.findFirst({
      where: (table, { eq }) => eq(table.id, instance.id),
    });

    expect(deletedInstance).toBeUndefined();
  });

  it('should cancel instance when transitions exist', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const { instance } = setup.instances[0]!;
    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Insert a state transition history record to simulate a transition having occurred
    await db.insert(stateTransitionHistory).values([
      {
        processInstanceId: instance.id,
        fromStateId: 'initial',
        toStateId: 'final',
        transitionedAt: new Date(),
      },
    ]);

    const result = await caller.decision.deleteInstance({
      instanceId: instance.id,
    });

    expect(result.success).toBe(true);
    expect(result.action).toBe('cancelled');
    expect(result.instanceId).toBe(instance.id);

    // Verify the instance was cancelled, not deleted
    const cancelledInstance = await db._query.processInstances.findFirst({
      where: (table, { eq }) => eq(table.id, instance.id),
    });

    expect(cancelledInstance).toBeDefined();
    expect(cancelledInstance!.status).toBe('cancelled');
  });

  it('should require authentication', async () => {
    const caller = createCaller({
      session: null,
      user: null,
    } as never);

    await expect(
      caller.decision.deleteInstance({
        instanceId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toThrow(/authenticate/i);
  });

  it('should throw error for non-existent instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.deleteInstance({
        instanceId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toThrow(/not found/i);
  });

  it('should not allow user with member profile access to delete instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // Create instance owned by first user
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const { instance, profileId } = setup.instances[0]!;

    // Create a second user with MEMBER access on the decision profile (not admin)
    const memberUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [profileId], // grants MEMBER role on profile
    });

    const memberCaller = await createAuthenticatedCaller(memberUser.email);

    // Member should not be able to delete the instance (requires admin profile access)
    await expect(
      memberCaller.decision.deleteInstance({
        instanceId: instance.id,
      }),
    ).rejects.toThrow(/access denied|not authorized|unauthorized/i);

    // Verify the instance still exists
    const existingInstance = await db._query.processInstances.findFirst({
      where: (table, { eq }) => eq(table.id, instance.id),
    });

    expect(existingInstance).toBeDefined();
  });

  it('should allow user with admin profile access to delete instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // Create instance owned by first user
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const { instance, profileId } = setup.instances[0]!;

    // Create a second user who is not the owner
    const adminUser = await testData.createMemberUser({
      organization: setup.organization,
      // Don't pass instanceProfileIds - we'll grant admin access manually
    });

    // Grant admin access on the decision profile (not just member)
    await testData.grantProfileAccess(
      profileId,
      adminUser.authUserId,
      adminUser.email,
      true, // isAdmin = true
    );

    const adminCaller = await createAuthenticatedCaller(adminUser.email);

    // User with admin profile access should be able to delete the instance
    const result = await adminCaller.decision.deleteInstance({
      instanceId: instance.id,
    });

    expect(result.success).toBe(true);
    expect(result.action).toBe('deleted');
    expect(result.instanceId).toBe(instance.id);

    // Verify the instance was actually deleted
    const deletedInstance = await db._query.processInstances.findFirst({
      where: (table, { eq }) => eq(table.id, instance.id),
    });

    expect(deletedInstance).toBeUndefined();
  });

  it('should handle already cancelled instance gracefully', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const { instance } = setup.instances[0]!;
    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Pre-cancel the instance and add a transition so delete would try to cancel again
    await db
      .update(processInstances)
      .set({ status: ProcessStatus.CANCELLED })
      .where(eq(processInstances.id, instance.id));

    await db.insert(stateTransitionHistory).values([
      {
        processInstanceId: instance.id,
        fromStateId: 'initial',
        toStateId: 'final',
        transitionedAt: new Date(),
      },
    ]);

    // Calling delete on an already cancelled instance should still succeed
    const result = await caller.decision.deleteInstance({
      instanceId: instance.id,
    });

    expect(result.success).toBe(true);
    expect(result.action).toBe('cancelled');
    expect(result.instanceId).toBe(instance.id);

    // Verify the instance is still cancelled
    const cancelledInstance = await db._query.processInstances.findFirst({
      where: (table, { eq }) => eq(table.id, instance.id),
    });

    expect(cancelledInstance).toBeDefined();
    expect(cancelledInstance!.status).toBe('cancelled');
  });
});
