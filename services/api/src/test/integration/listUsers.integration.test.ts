import { db } from '@op/db/client';
import { organizationUserToAccessRoles } from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { TContext } from 'src/types';
import { describe, expect, it } from 'vitest';

import { organizationRouter } from '../../routers/organization';
import { createCallerFactory } from '../../trpcFactory';
import { TestOrganizationDataManager } from '../helpers/TestOrganizationDataManager';
import {
  getCurrentTestSession,
  signInTestUser,
  signOutTestUser,
} from '../supabase-utils';

describe('organization.listUsers', () => {
  const createCaller = createCallerFactory(organizationRouter);

  const createTestContext = (jwt: string): TContext => ({
    jwt,
    req: {
      headers: { get: () => '127.0.0.1' },
      url: 'http://localhost:3000/api/trpc',
    } as any,
    ip: '127.0.0.1',
    reqUrl: 'http://localhost:3000/api/trpc',
    requestId: 'test-request-id',
    getCookies: () => ({}),
    getCookie: () => undefined,
    setCookie: () => {},
    time: Date.now(),
  });

  it('should successfully list organization users', async ({ task }) => {
    // Create test data manager - automatically registers cleanup
    const testData = new TestOrganizationDataManager(task.id);
    const { organization, adminUser, memberUsers } =
      await testData.createOrganization({
        users: { admin: 1, member: 1 },
      });

    // Sign in the test user
    await signOutTestUser();
    await signInTestUser(adminUser.email);
    const session = await getCurrentTestSession();
    if (!session) {
      throw new Error('No session found for test user');
    }

    const caller = createCaller(createTestContext(session.access_token));

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

  it('should correctly return users with multiple roles', async ({ task }) => {
    // Create test data manager - automatically registers cleanup
    const testData = new TestOrganizationDataManager(task.id);
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

    // Sign in the test user
    await signOutTestUser();
    await signInTestUser(adminUser.email);
    const session = await getCurrentTestSession();
    if (!session) {
      throw new Error('No session found for test user');
    }
    const caller = createCaller(createTestContext(session.access_token));
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

  it('should throw error for invalid profile ID', async ({ task }) => {
    // Create test data manager - automatically registers cleanup
    const testData = new TestOrganizationDataManager(task.id);
    const { adminUser } = await testData.createOrganization();

    // Sign in the test user
    await signOutTestUser();
    await signInTestUser(adminUser.email);
    const session = await getCurrentTestSession();
    if (!session) {
      throw new Error('No session found for test user');
    }
    const caller = createCaller(createTestContext(session.access_token));
    expect(async () => {
      await caller.listUsers({
        profileId: '00000000-0000-0000-0000-000000000000',
      });
    }).rejects.toThrow();
  });
});
