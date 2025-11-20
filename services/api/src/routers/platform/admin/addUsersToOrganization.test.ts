import { db } from '@op/db/client';
import { ROLES } from '@op/db/seedData/accessControl';
import { describe, expect, it } from 'vitest';

import { TestOrganizationDataManager } from '../../../test/helpers/TestOrganizationDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';
import { platformAdminRouter } from './index';

const createCaller = createCallerFactory(platformAdminRouter);

describe.concurrent('platform.admin.addUsersToOrganization', () => {
  describe.concurrent('Authorization', () => {
    it('should reject requests from non-platform-admin users', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);

      // Create a regular user (non-platform-admin) using a non-oneproject.org domain
      const { adminUser: regularUser, memberUsers } =
        await testData.createOrganization({
          users: { admin: 1, member: 1 },
          emailDomain: 'example.com',
        });

      const userToAdd = memberUsers[0];
      if (!userToAdd) {
        throw new Error('Failed to create member user to add');
      }

      // Create another organization to try adding users to
      const { organization: targetOrg } = await testData.createOrganization({
        users: { admin: 1 },
        organizationName: 'Target Org',
      });

      // Create isolated session for the regular user
      const { session } = await createIsolatedSession(regularUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      // Attempt to add users to the organization - should fail
      await expect(() =>
        caller.addUsersToOrganization({
          organizationId: targetOrg.id,
          users: [
            {
              authUserId: userToAdd.authUserId,
              roleId: ROLES.MEMBER.id,
            },
          ],
        }),
      ).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });

    it('should allow platform admins to add users to any organization', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);

      // Create a platform admin user (oneproject.org domain)
      const { adminUser: platformAdmin } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'oneproject.org',
      });

      // Create an organization (not owned by the admin)
      const { organization: targetOrg, adminUser: userToAdd } =
        await testData.createOrganization({
          users: { admin: 1 },
          organizationName: 'Target Org',
          emailDomain: 'example.com',
        });

      const { session } = await createIsolatedSession(platformAdmin.email);
      const caller = createCaller(await createTestContextWithSession(session));

      // Successfully add users to the organization
      const result = await caller.addUsersToOrganization({
        organizationId: targetOrg.id,
        users: [
          {
            authUserId: userToAdd.authUserId,
            roleId: ROLES.MEMBER.id,
          },
        ],
      });

      // Verify it succeeded
      expect(result).toEqual([
        {
          authUserId: userToAdd.authUserId,
          organizationUserId: expect.any(String),
        },
      ]);
    });
  });

  describe.concurrent('Input Validation', () => {
    it('should reject non-existent organizationId', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);

      // Create a platform admin user
      const { adminUser: platformAdmin } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'oneproject.org',
      });

      // Create a user to add
      const { adminUser: userToAdd } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'example.com',
      });

      const { session } = await createIsolatedSession(platformAdmin.email);
      const caller = createCaller(await createTestContextWithSession(session));

      // Use a non-existent organization ID (random UUID)
      const fakeOrgId = '00000000-0000-0000-0000-999999999999';

      await expect(() =>
        caller.addUsersToOrganization({
          organizationId: fakeOrgId,
          users: [
            {
              authUserId: userToAdd.authUserId,
              roleId: ROLES.MEMBER.id,
            },
          ],
        }),
      ).rejects.toMatchObject({
        cause: {
          name: 'NotFoundError',
        },
      });
    });

    it('should reject empty users array', async ({ task, onTestFinished }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);

      // Create a platform admin user
      const { adminUser: platformAdmin } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'oneproject.org',
      });

      // Create an organization to add users to
      const { organization: targetOrg } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'example.com',
      });

      const { session } = await createIsolatedSession(platformAdmin.email);
      const caller = createCaller(await createTestContextWithSession(session));

      // Attempt to add empty users array - Zod validation should catch this
      await expect(() =>
        caller.addUsersToOrganization({
          organizationId: targetOrg.id,
          users: [],
        }),
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    });

    it('should reject users without authUserId', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);

      // Create a platform admin user
      const { adminUser: platformAdmin } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'oneproject.org',
      });

      // Create an organization to add users to
      const { organization: targetOrg } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'example.com',
      });

      const { session } = await createIsolatedSession(platformAdmin.email);
      const caller = createCaller(await createTestContextWithSession(session));

      // Attempt to add user without authUserId - Zod validation should catch this
      await expect(() =>
        caller.addUsersToOrganization({
          organizationId: targetOrg.id,
          users: [
            {
              roleId: ROLES.MEMBER.id,
            } as any,
          ],
        }),
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    });

    it('should reject users without roleId', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);

      // Create a platform admin user
      const { adminUser: platformAdmin } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'oneproject.org',
      });

      // Create an organization and user to add
      const { organization: targetOrg } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'example.com',
      });

      const { adminUser: userToAdd } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'test.com',
      });

      const { session } = await createIsolatedSession(platformAdmin.email);
      const caller = createCaller(await createTestContextWithSession(session));

      // Attempt to add user without roleId - Zod validation should catch this
      await expect(() =>
        caller.addUsersToOrganization({
          organizationId: targetOrg.id,
          users: [
            {
              authUserId: userToAdd.authUserId,
            } as any,
          ],
        }),
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    });

    it('should reject non-existent role ids', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);

      // Create a platform admin user
      const { adminUser: platformAdmin } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'oneproject.org',
      });

      // Create an organization and user to add
      const { organization: targetOrg } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'example.com',
      });

      const { adminUser: userToAdd } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'test.com',
      });

      const { session } = await createIsolatedSession(platformAdmin.email);
      const caller = createCaller(await createTestContextWithSession(session));

      // Use a non-existent role ID (random UUID)
      const fakeRoleId = '00000000-0000-0000-0000-888888888888';

      await expect(() =>
        caller.addUsersToOrganization({
          organizationId: targetOrg.id,
          users: [
            {
              authUserId: userToAdd.authUserId,
              roleId: fakeRoleId,
            },
          ],
        }),
      ).rejects.toMatchObject({
        cause: {
          name: 'NotFoundError',
        },
      });
    });

    it('should reject non-existent authUserId', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);

      // Create a platform admin user
      const { adminUser: platformAdmin } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'oneproject.org',
      });

      // Create an organization to add users to
      const { organization: targetOrg } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'example.com',
      });

      const { session } = await createIsolatedSession(platformAdmin.email);
      const caller = createCaller(await createTestContextWithSession(session));

      // Use a non-existent authUserId (random UUID)
      const fakeAuthUserId = '00000000-0000-0000-0000-777777777777';

      await expect(() =>
        caller.addUsersToOrganization({
          organizationId: targetOrg.id,
          users: [
            {
              authUserId: fakeAuthUserId,
              roleId: ROLES.MEMBER.id,
            },
          ],
        }),
      ).rejects.toMatchObject({
        cause: {
          name: 'NotFoundError',
        },
      });
    });
  });

  describe.concurrent('Adding Existing Users', () => {
    it('should add a single existing user with one role', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);

      // Create platform admin
      const { adminUser: platformAdmin } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'oneproject.org',
      });

      // Create organization (target org to add users to)
      const { organization: targetOrg } = await testData.createOrganization({
        users: { admin: 1 },
        organizationName: 'Target Organization',
        emailDomain: 'example.com',
      });

      // Create existing user (not in the target org)
      const { adminUser: userToAdd } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'test.com',
      });

      // Setup platform admin session
      const { session } = await createIsolatedSession(platformAdmin.email);
      const caller = createCaller(await createTestContextWithSession(session));

      // Add user to organization with Member role
      const result = await caller.addUsersToOrganization({
        organizationId: targetOrg.id,
        users: [
          {
            authUserId: userToAdd.authUserId,
            roleId: ROLES.MEMBER.id,
          },
        ],
      });

      // Verify response structure
      expect(result).toMatchObject([
        {
          authUserId: userToAdd.authUserId,
          organizationUserId: expect.any(String),
        },
      ]);

      // Verify organizationUser record and role assignment
      const orgUser = await db.query.organizationUsers.findFirst({
        where: (table, { and, eq }) =>
          and(
            eq(table.authUserId, userToAdd.authUserId),
            eq(table.organizationId, targetOrg.id),
          ),
        with: {
          roles: {
            with: {
              accessRole: true,
            },
          },
        },
      });

      expect(orgUser).toMatchObject({
        authUserId: userToAdd.authUserId,
        organizationId: targetOrg.id,
        roles: [
          {
            accessRole: {
              id: ROLES.MEMBER.id,
            },
          },
        ],
      });
    });

    it('should add a single existing user with a role', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);

      // Create platform admin
      const { adminUser: platformAdmin } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'oneproject.org',
      });

      // Create organization
      const { organization: targetOrg } = await testData.createOrganization({
        users: { admin: 1 },
        organizationName: 'Target Organization',
        emailDomain: 'example.com',
      });

      // Create existing user
      const { adminUser: userToAdd } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'test.com',
      });

      // Setup platform admin session
      const { session } = await createIsolatedSession(platformAdmin.email);
      const caller = createCaller(await createTestContextWithSession(session));

      // Add user with Admin role
      const result = await caller.addUsersToOrganization({
        organizationId: targetOrg.id,
        users: [
          {
            authUserId: userToAdd.authUserId,
            roleId: ROLES.ADMIN.id,
          },
        ],
      });

      // Verify response
      expect(result).toHaveLength(1);
      expect(result[0]?.authUserId).toBe(userToAdd.authUserId);

      // Verify role is assigned
      const orgUser = await db.query.organizationUsers.findFirst({
        where: (table, { and, eq }) =>
          and(
            eq(table.authUserId, userToAdd.authUserId),
            eq(table.organizationId, targetOrg.id),
          ),
        with: {
          roles: {
            with: {
              accessRole: true,
            },
          },
        },
      });

      expect(orgUser?.roles).toHaveLength(1);
      expect(orgUser?.roles[0]?.accessRole.id).toBe(ROLES.ADMIN.id);
    });

    it('should add multiple existing users in a batch', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);

      // Create platform admin
      const { adminUser: platformAdmin } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'oneproject.org',
      });

      // Create organization
      const { organization: targetOrg } = await testData.createOrganization({
        organizationName: 'Target Organization',
        emailDomain: 'example.com',
      });

      // Create 3 existing users
      const user1 = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'user1.com',
      });
      const user2 = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'user2.com',
      });
      const user3 = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'user3.com',
      });

      // Setup platform admin session
      const { session } = await createIsolatedSession(platformAdmin.email);
      const caller = createCaller(await createTestContextWithSession(session));

      // Add all 3 users in one request with different roles
      const result = await caller.addUsersToOrganization({
        organizationId: targetOrg.id,
        users: [
          {
            authUserId: user1.adminUser.authUserId,
            roleId: ROLES.ADMIN.id,
          },
          {
            authUserId: user2.adminUser.authUserId,
            roleId: ROLES.MEMBER.id,
          },
          {
            authUserId: user3.adminUser.authUserId,
            roleId: ROLES.ADMIN.id,
          },
        ],
      });

      // Verify all users added successfully
      expect(result).toHaveLength(3);

      // Verify each user has correct roles
      const orgUsers = await db.query.organizationUsers.findMany({
        where: (table, { eq }) => eq(table.organizationId, targetOrg.id),
        with: {
          roles: {
            with: {
              accessRole: true,
            },
          },
        },
      });

      // Filter out the original admin user, only check the 3 newly added users
      const addedUsers = orgUsers.filter((ou) =>
        [
          user1.adminUser.authUserId,
          user2.adminUser.authUserId,
          user3.adminUser.authUserId,
        ].includes(ou.authUserId),
      );

      expect(addedUsers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            authUserId: user1.adminUser.authUserId,
            roles: [
              expect.objectContaining({
                accessRole: expect.objectContaining({
                  id: ROLES.ADMIN.id,
                }),
              }),
            ],
          }),
          expect.objectContaining({
            authUserId: user2.adminUser.authUserId,
            roles: [
              expect.objectContaining({
                accessRole: expect.objectContaining({
                  id: ROLES.MEMBER.id,
                }),
              }),
            ],
          }),
          expect.objectContaining({
            authUserId: user3.adminUser.authUserId,
            roles: [
              expect.objectContaining({
                accessRole: expect.objectContaining({
                  id: ROLES.ADMIN.id,
                }),
              }),
            ],
          }),
        ]),
      );
    });

    it('should handle existing user already in the organization gracefully', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);

      // Create platform admin
      const { adminUser: platformAdmin } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'oneproject.org',
      });

      // Create organization with existing member
      const { organization: targetOrg, adminUser: existingMember } =
        await testData.createOrganization({
          users: { admin: 1 },
          organizationName: 'Target Organization',
          emailDomain: 'example.com',
        });

      // Setup platform admin session
      const { session } = await createIsolatedSession(platformAdmin.email);
      const caller = createCaller(await createTestContextWithSession(session));

      // Attempt to add the same user again - joinOrganization should handle this gracefully
      // and return the existing membership
      const result = await caller.addUsersToOrganization({
        organizationId: targetOrg.id,
        users: [
          {
            authUserId: existingMember.authUserId,
            roleId: ROLES.MEMBER.id,
          },
        ],
      });

      // Verify the operation succeeded and returned the user
      expect(result).toEqual([
        {
          authUserId: existingMember.authUserId,
          organizationUserId: expect.any(String),
        },
      ]);
    });
  });
});
