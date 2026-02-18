import { db, eq } from '@op/db/client';
import { organizationUsers } from '@op/db/schema';
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

describe.concurrent('getCategories permissions', () => {
  it('should allow access for a user with profile-level permissions', async ({
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

    const result = await caller.decision.getCategories({
      processInstanceId: instance.instance.id,
    });

    expect(result).toHaveProperty('categories');
    expect(Array.isArray(result.categories)).toBe(true);
  });

  it('should allow access for a member with profile-level permissions', async ({
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

    const memberUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const memberCaller = await createAuthenticatedCaller(memberUser.email);

    const result = await memberCaller.decision.getCategories({
      processInstanceId: instance.instance.id,
    });

    expect(result).toHaveProperty('categories');
    expect(Array.isArray(result.categories)).toBe(true);
  });

  it('should allow access via org-level fallback when user lacks profile access', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: false,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    // The admin user has org-level access (created the org) but no profile-level
    // access on the instance (grantAccess: false). The org fallback should allow access.
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.getCategories({
      processInstanceId: instance.instance.id,
    });

    expect(result).toHaveProperty('categories');
    expect(Array.isArray(result.categories)).toBe(true);
  });

  it('should deny access for a user with no profile or org access', async ({
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

    // Create a member user with no instance profile access
    const outsiderUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [],
    });

    // Remove the user from the organization so they have no org-level fallback
    await db
      .delete(organizationUsers)
      .where(eq(organizationUsers.authUserId, outsiderUser.authUserId));

    const unauthorizedCaller = await createAuthenticatedCaller(
      outsiderUser.email,
    );

    await expect(
      unauthorizedCaller.decision.getCategories({
        processInstanceId: instance.instance.id,
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('should allow access via org member role fallback when user has no profile access', async ({
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

    // Create a member with org access but no instance profile access
    const memberUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [],
    });

    const memberCaller = await createAuthenticatedCaller(memberUser.email);

    // Member role at org level has decisions READ permission,
    // so this should succeed via org fallback
    const result = await memberCaller.decision.getCategories({
      processInstanceId: instance.instance.id,
    });

    expect(result).toHaveProperty('categories');
  });
});
