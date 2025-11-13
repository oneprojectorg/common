import { db } from '@op/db/client';
import { organizationUserToAccessRoles } from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { TContext } from 'src/types';
import { describe, expect, it } from 'vitest';

import { organizationRouter } from '../../routers/organization';
import { createCallerFactory } from '../../trpcFactory';
import { TestOrganizationDataManager } from '../helpers/TestOrganizationDataManager';
import { getJWTForUser } from '../supabase-utils';

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
    setCookie: () => { },
    time: Date.now(),
    isServerSideCall: true, // Bypass rate limiting for tests
  });

  it.concurrent(
    'should successfully list organization users',
    async ({ task, onTestFinished }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);
      const { organization, adminUser, memberUsers } =
        await testData.createOrganization({
          users: { admin: 1, member: 1 },
        });

      // Get JWT for the test user (safe for concurrent tests)
      const accessToken = await getJWTForUser(adminUser.email);
      const caller = createCaller(createTestContext(accessToken));

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
    },
  );

  it.concurrent(
    'should correctly return users with multiple roles',
    async ({ task, onTestFinished }) => {
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

      // Get JWT for the test user (safe for concurrent tests)
      const accessToken = await getJWTForUser(adminUser.email);
      const caller = createCaller(createTestContext(accessToken));
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
    },
  );

  it.concurrent(
    'should throw error for invalid profile ID',
    async ({ task, onTestFinished }) => {
      // Create test data manager - automatically registers cleanup
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);
      const { adminUser } = await testData.createOrganization();

      // Get JWT for the test user (safe for concurrent tests)
      const accessToken = await getJWTForUser(adminUser.email);
      const caller = createCaller(createTestContext(accessToken));
      await expect(async () => {
        await caller.listUsers({
          profileId: '00000000-0000-0000-0000-000000000000',
        });
      }).rejects.toThrow();
    },
  );
});
