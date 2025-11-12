import { db } from '@op/db/client';
import { organizationUserToAccessRoles } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { organizationRouter } from '../../routers/organization';
import { createCallerFactory } from '../../trpcFactory';
import { TestDataManager } from '../helpers/test-data-manager';
import {
  getCurrentTestSession,
  signInTestUser,
  signOutTestUser,
} from '../supabase-utils';

describe('organization.listUsers', () => {
  const createCaller: ReturnType<typeof createCallerFactory> =
    createCallerFactory(organizationRouter);

  const createTestContext = (jwt: string) => ({
    jwt,
    req: {
      headers: { get: () => '127.0.0.1' },
      url: 'http://localhost:3000/api/trpc',
    } as any,
    res: {} as any,
    ip: '127.0.0.1',
    reqUrl: 'http://localhost:3000/api/trpc',
    isServerSideCall: true, // Skip rate limiting in tests
    getCookies: () => ({}),
  });

  it('should successfully list organization users', async ({ task }) => {
    // Create test data manager - automatically registers cleanup
    const testData = new TestDataManager(task.id);
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

    // @ts-expect-error - Test context uses simplified structure
    const caller = createCaller(createTestContext(session!.access_token));

    // TODO:
    // if (!('listUsers' in caller) || typeof caller.listUsers !== 'function') {
    //   throw new Error('listUsers procedure not found in organizationRouter');
    // }

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
    const testData = new TestDataManager(task.id);
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

    const memberRole = await db.query.accessRoles.findFirst({
      where: (table, { eq }) => eq(table.name, 'Member'),
    });

    if (!memberRole) {
      throw new Error('Member role not found');
    }

    // Add multiple roles to the user
    await db.insert(organizationUserToAccessRoles).values([
      {
        organizationUserId: orgUser.id,
        accessRoleId: memberRole.id,
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

    const userWithRoles = result.find((user) => user.email === adminUser.email);
    expect(userWithRoles).toBeDefined();
    expect(userWithRoles.roles).toMatchObject([
      { name: 'Admin' },
      { name: 'Member' },
    ]);
  });

  it('should throw error for invalid profile ID', async ({ task }) => {
    // Create test data manager - automatically registers cleanup
    const testData = new TestDataManager(task.id);
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
