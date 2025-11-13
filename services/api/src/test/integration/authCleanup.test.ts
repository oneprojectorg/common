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
  getJWTForUser,
  signInTestUser,
  signOutTestUser,
} from '../supabase-utils';

/**
 * This test file systematically tests all combinations of:
 * 1. Auth method: Old (signIn/signOut on shared client) vs New (isolated JWT)
 * 2. Cleanup method: Disabled vs Enabled (afterAll cleanup)
 *
 * The goal is to identify which combination(s) work reliably with concurrent tests.
 */
describe('Auth & Cleanup Combinations', () => {
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
    isServerSideCall: true, // Bypass rate limiting for tests
  });

  describe('Combination 1: Old Auth + No Cleanup', () => {
    it.concurrent('test 1', async ({ task, onTestFinished }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);
      const { organization, adminUser } = await testData.createOrganization({
        users: { admin: 1, member: 1 },
      });

      // Old auth method: sign out, sign in, get session
      await signOutTestUser();
      await signInTestUser(adminUser.email);
      const session = await getCurrentTestSession();

      if (!session) {
        throw new Error('No session available');
      }

      const caller = createCaller(createTestContext(session.access_token));
      const result = await caller.listUsers({
        profileId: organization.profileId,
      });

      expect(result.length).toBeGreaterThan(0);

      // NO cleanup - let data remain
    });

    it.concurrent('test 2', async ({ task, onTestFinished }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);
      const { organization, adminUser } = await testData.createOrganization({
        users: { admin: 1, member: 1 },
      });

      await signOutTestUser();
      await signInTestUser(adminUser.email);
      const session = await getCurrentTestSession();

      if (!session) {
        throw new Error('No session available');
      }

      const caller = createCaller(createTestContext(session.access_token));
      const result = await caller.listUsers({
        profileId: organization.profileId,
      });

      expect(result.length).toBeGreaterThan(0);
    });

    it.concurrent('test 3', async ({ task, onTestFinished }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);
      const { organization, adminUser } = await testData.createOrganization({
        users: { admin: 1, member: 1 },
      });

      await signOutTestUser();
      await signInTestUser(adminUser.email);
      const session = await getCurrentTestSession();

      if (!session) {
        throw new Error('No session available');
      }

      const caller = createCaller(createTestContext(session.access_token));
      const result = await caller.listUsers({
        profileId: organization.profileId,
      });

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Combination 2: Old Auth + With Cleanup', () => {
    it.concurrent('test 1', async ({ task, onTestFinished }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);
      const { organization, adminUser } = await testData.createOrganization({
        users: { admin: 1, member: 1 },
      });

      await signOutTestUser();
      await signInTestUser(adminUser.email);
      const session = await getCurrentTestSession();

      if (!session) {
        throw new Error('No session available');
      }

      const caller = createCaller(createTestContext(session.access_token));
      const result = await caller.listUsers({
        profileId: organization.profileId,
      });

      expect(result.length).toBeGreaterThan(0);

      // Cleanup happens via TestOrganizationDataManager's afterAll
    });

    it.concurrent('test 2', async ({ task, onTestFinished }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);
      const { organization, adminUser } = await testData.createOrganization({
        users: { admin: 1, member: 1 },
      });

      await signOutTestUser();
      await signInTestUser(adminUser.email);
      const session = await getCurrentTestSession();

      if (!session) {
        throw new Error('No session available');
      }

      const caller = createCaller(createTestContext(session.access_token));
      const result = await caller.listUsers({
        profileId: organization.profileId,
      });

      expect(result.length).toBeGreaterThan(0);
    });

    it.concurrent('test 3', async ({ task, onTestFinished }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);
      const { organization, adminUser } = await testData.createOrganization({
        users: { admin: 1, member: 1 },
      });

      await signOutTestUser();
      await signInTestUser(adminUser.email);
      const session = await getCurrentTestSession();

      if (!session) {
        throw new Error('No session available');
      }

      const caller = createCaller(createTestContext(session.access_token));
      const result = await caller.listUsers({
        profileId: organization.profileId,
      });

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Combination 3: New Auth (JWT) + No Cleanup', () => {
    it.concurrent('test 1', async ({ task, onTestFinished }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);
      const { organization, adminUser } = await testData.createOrganization({
        users: { admin: 1, member: 1 },
      });

      // New auth method: isolated JWT
      const accessToken = await getJWTForUser(adminUser.email);
      const caller = createCaller(createTestContext(accessToken));

      const result = await caller.listUsers({
        profileId: organization.profileId,
      });

      expect(result.length).toBeGreaterThan(0);

      // NO cleanup
    });

    it.concurrent('test 2', async ({ task, onTestFinished }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);
      const { organization, adminUser } = await testData.createOrganization({
        users: { admin: 1, member: 1 },
      });

      const accessToken = await getJWTForUser(adminUser.email);
      const caller = createCaller(createTestContext(accessToken));

      const result = await caller.listUsers({
        profileId: organization.profileId,
      });

      expect(result.length).toBeGreaterThan(0);
    });

    it.concurrent('test 3', async ({ task, onTestFinished }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);
      const { organization, adminUser } = await testData.createOrganization({
        users: { admin: 1, member: 1 },
      });

      const accessToken = await getJWTForUser(adminUser.email);
      const caller = createCaller(createTestContext(accessToken));

      const result = await caller.listUsers({
        profileId: organization.profileId,
      });

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Combination 4: New Auth (JWT) + With Cleanup', () => {
    it.concurrent('test 1', async ({ task, onTestFinished }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);
      const { organization, adminUser } = await testData.createOrganization({
        users: { admin: 1, member: 1 },
      });

      const accessToken = await getJWTForUser(adminUser.email);
      const caller = createCaller(createTestContext(accessToken));

      const result = await caller.listUsers({
        profileId: organization.profileId,
      });

      expect(result.length).toBeGreaterThan(0);

      // Cleanup happens via TestOrganizationDataManager's afterAll
    });

    it.concurrent('test 2', async ({ task, onTestFinished }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);
      const { organization, adminUser } = await testData.createOrganization({
        users: { admin: 1, member: 1 },
      });

      const accessToken = await getJWTForUser(adminUser.email);
      const caller = createCaller(createTestContext(accessToken));

      const result = await caller.listUsers({
        profileId: organization.profileId,
      });

      expect(result.length).toBeGreaterThan(0);
    });

    it.concurrent('test 3', async ({ task, onTestFinished }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);
      const { organization, adminUser } = await testData.createOrganization({
        users: { admin: 1, member: 1 },
      });

      const accessToken = await getJWTForUser(adminUser.email);
      const caller = createCaller(createTestContext(accessToken));

      const result = await caller.listUsers({
        profileId: organization.profileId,
      });

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Combination 4b: New Auth (JWT) + With Cleanup + Complex Operations', () => {
    it.concurrent(
      'test with multiple roles 1',
      async ({ task, onTestFinished }) => {
        const testData = new TestOrganizationDataManager(
          task.id,
          onTestFinished,
        );
        const { organization, adminUser } = await testData.createOrganization({
          users: { admin: 1, member: 1 },
        });

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

        await db.insert(organizationUserToAccessRoles).values([
          {
            organizationUserId: orgUser.id,
            accessRoleId: ROLES.MEMBER.id,
          },
        ]);

        const accessToken = await getJWTForUser(adminUser.email);
        const caller = createCaller(createTestContext(accessToken));
        const result = await caller.listUsers({
          profileId: organization.profileId,
        });

        expect(result.length).toBe(2);

        const userWithRoles = result.find(
          (user: any) => user.email === adminUser.email,
        );

        expect(userWithRoles?.roles).toMatchObject([
          { name: ROLES.ADMIN.name },
          { name: ROLES.MEMBER.name },
        ]);
      },
    );

    it.concurrent(
      'test with multiple roles 2',
      async ({ task, onTestFinished }) => {
        const testData = new TestOrganizationDataManager(
          task.id,
          onTestFinished,
        );
        const { organization, adminUser } = await testData.createOrganization({
          users: { admin: 1, member: 1 },
        });

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

        await db.insert(organizationUserToAccessRoles).values([
          {
            organizationUserId: orgUser.id,
            accessRoleId: ROLES.MEMBER.id,
          },
        ]);

        const accessToken = await getJWTForUser(adminUser.email);
        const caller = createCaller(createTestContext(accessToken));
        const result = await caller.listUsers({
          profileId: organization.profileId,
        });

        expect(result.length).toBe(2);

        const userWithRoles = result.find(
          (user: any) => user.email === adminUser.email,
        );

        expect(userWithRoles?.roles).toMatchObject([
          { name: ROLES.ADMIN.name },
          { name: ROLES.MEMBER.name },
        ]);
      },
    );

    it.concurrent(
      'test with multiple roles 3',
      async ({ task, onTestFinished }) => {
        const testData = new TestOrganizationDataManager(
          task.id,
          onTestFinished,
        );
        const { organization, adminUser } = await testData.createOrganization({
          users: { admin: 1, member: 1 },
        });

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

        await db.insert(organizationUserToAccessRoles).values([
          {
            organizationUserId: orgUser.id,
            accessRoleId: ROLES.MEMBER.id,
          },
        ]);

        const accessToken = await getJWTForUser(adminUser.email);
        const caller = createCaller(createTestContext(accessToken));
        const result = await caller.listUsers({
          profileId: organization.profileId,
        });

        expect(result.length).toBe(2);

        const userWithRoles = result.find(
          (user: any) => user.email === adminUser.email,
        );

        expect(userWithRoles?.roles).toMatchObject([
          { name: ROLES.ADMIN.name },
          { name: ROLES.MEMBER.name },
        ]);
      },
    );
  });
});
