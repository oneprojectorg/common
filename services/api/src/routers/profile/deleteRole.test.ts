import { db } from '@op/db/client';
import { accessRoles } from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import profileRouter from '.';
import { TestProfileUserDataManager } from '../../test/helpers/TestProfileUserDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

describe.concurrent('profile.deleteRole', () => {
  const createCaller = createCallerFactory(profileRouter);

  it('should allow admin to delete a profile-specific role', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    // Create a custom role for this profile
    const [customRole] = await db
      .insert(accessRoles)
      .values({
        name: `Custom Role ${task.id}`,
        description: 'A custom role for testing',
        profileId: profile.id,
      })
      .returning();

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.deleteRole({ roleId: customRole!.id });

    expect(result.success).toBe(true);

    // Verify role was deleted
    const deletedRole = await db.query.accessRoles.findFirst({
      where: { id: customRole!.id },
    });
    expect(deletedRole).toBeUndefined();
  });

  it('should not allow non-admin to delete a role', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, memberUsers } = await testData.createProfile({
      users: { admin: 1, member: 1 },
    });

    // Create a custom role for this profile
    const [customRole] = await db
      .insert(accessRoles)
      .values({
        name: `Custom Role ${task.id}`,
        description: 'A custom role for testing',
        profileId: profile.id,
      })
      .returning();

    // Track for cleanup
    onTestFinished(async () => {
      if (customRole) {
        await db.delete(accessRoles).where(eq(accessRoles.id, customRole.id));
      }
    });

    const { session } = await createIsolatedSession(memberUsers[0]!.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.deleteRole({ roleId: customRole!.id }),
    ).rejects.toSatisfy(
      (error: Error & { cause?: Error }) =>
        error.cause?.name === 'AccessControlException',
    );

    // Verify role still exists after failed delete attempt
    const roleStillExists = await db.query.accessRoles.findFirst({
      where: { id: customRole!.id },
    });
    expect(roleStillExists).toBeDefined();
  });

  it('should not allow deleting global roles', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Try to delete the global Admin role
    await expect(caller.deleteRole({ roleId: ROLES.ADMIN.id })).rejects.toThrow(
      'Cannot delete global roles',
    );
  });

  it('should throw error when role not found', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    await expect(
      caller.deleteRole({ roleId: nonExistentId }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });

  it('should not allow admin from different profile to delete role', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);

    // Create Profile A with a custom role
    const { profile: profileA } = await testData.createProfile({
      users: { admin: 1 },
    });

    const [customRole] = await db
      .insert(accessRoles)
      .values({
        name: `Custom Role ${task.id}`,
        description: 'A custom role for Profile A',
        profileId: profileA.id,
      })
      .returning();

    onTestFinished(async () => {
      if (customRole) {
        await db.delete(accessRoles).where(eq(accessRoles.id, customRole.id));
      }
    });

    // Create Profile B with its own admin
    const { adminUser: adminB } = await testData.createProfile({
      users: { admin: 1 },
    });

    // Admin from Profile B should not be able to delete Profile A's role
    const { session } = await createIsolatedSession(adminB.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.deleteRole({ roleId: customRole!.id }),
    ).rejects.toSatisfy(
      (error: Error & { cause?: Error }) =>
        error.cause?.name === 'UnauthorizedError',
    );

    // Verify role still exists
    const roleStillExists = await db.query.accessRoles.findFirst({
      where: { id: customRole!.id },
    });
    expect(roleStillExists).toBeDefined();
  });
});
