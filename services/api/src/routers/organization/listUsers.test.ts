import { db } from '@op/db/client';
import { organizationUserToAccessRoles } from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { describe, expect, it } from 'vitest';

import { organizationRouter } from '.';
import { TestOrganizationDataManager } from '../../test/helpers/TestOrganizationDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

describe.concurrent('organization.listUsers', () => {
  const createCaller = createCallerFactory(organizationRouter);

  it('should successfully list organization users', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { organization, adminUser, memberUsers } =
      await testData.createOrganization({
        users: { admin: 1, member: 1 },
      });

    // Create isolated session for this test
    const { session } = await createIsolatedSession(adminUser.email);

    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.listUsers({
      profileId: organization.profileId,
    });

    expect(result).toMatchObject([
      {
        email: adminUser.email,
      },
      ...memberUsers.map((m) => ({
        email: m.email,
      })),
    ]);
  });

  it('should correctly return users with multiple roles', async ({
    task,
    onTestFinished,
  }) => {
    // Create test data manager - automatically registers cleanup
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { organization, adminUser } = await testData.createOrganization({
      users: { admin: 1, member: 1 },
    });

    // Get the organization user
    const orgUser = await db.query.organizationUsers.findFirst({
      where: (table, { eq, and }) =>
        and(
          eq(table.organizationId, organization.id),
          eq(table.authUserId, adminUser.authUserId),
        ),
    });

    if (!orgUser) {
      throw new Error('Organization user not found for admin user');
    }

    // Add multiple roles to the user using predefined role ID
    await db.insert(organizationUserToAccessRoles).values([
      {
        organizationUserId: orgUser.id,
        accessRoleId: ROLES.MEMBER.id,
      },
    ]);

    // Create isolated session for this test
    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));
    const result = await caller.listUsers({
      profileId: organization.profileId,
    });

    expect(result.length).toBe(2);

    const userWithRoles = result.find(
      (user: any) => user.email === adminUser.email,
    );

    if (!userWithRoles) {
      throw new Error('Admin user not found in result');
    }

    expect(userWithRoles.roles).toMatchObject([
      { name: ROLES.ADMIN.name },
      { name: ROLES.MEMBER.name },
    ]);
  });

  it('should throw error for invalid profile ID', async ({
    task,
    onTestFinished,
  }) => {
    // Create test data manager - automatically registers cleanup
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { adminUser } = await testData.createOrganization();

    // Create isolated session for this test
    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));
    await expect(async () => {
      await caller.listUsers({
        profileId: '00000000-0000-0000-0000-000000000000',
      });
    }).rejects.toThrow();
  });
});
