import { db, eq } from '@op/db/client';
import { accessRoles, profileUsers } from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { describe, expect, it } from 'vitest';

import { TestProfileUserDataManager } from '../../../test/helpers/TestProfileUserDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';
import { usersRouter } from './index';

describe.concurrent('profile.users.updateUserRoles', () => {
  const createCaller = createCallerFactory(usersRouter);

  it('should update user roles', async ({ task, onTestFinished }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { adminUser, memberUsers } = await testData.createProfile({
      users: { admin: 1, member: 1 },
    });

    const memberUser = memberUsers[0];
    if (!memberUser) {
      throw new Error('Expected memberUser to be defined');
    }

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Update member to admin
    const result = await caller.updateUserRoles({
      profileUserId: memberUser.profileUserId,
      roleIds: [ROLES.ADMIN.id],
    });

    expect(result).toBeDefined();

    // Verify role was updated
    const updatedUser = await db.query.profileUsers.findFirst({
      where: { id: memberUser.profileUserId },
      with: {
        roles: {
          with: {
            accessRole: true,
          },
        },
      },
    });

    expect(updatedUser?.roles).toHaveLength(1);
    expect(updatedUser?.roles[0]?.accessRole.id).toBe(ROLES.ADMIN.id);
  });

  it('should reject non-assignable system global roles', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { adminUser, memberUsers } = await testData.createProfile({
      users: { admin: 1, member: 1 },
    });

    const memberUser = memberUsers[0];
    if (!memberUser) {
      throw new Error('Expected memberUser to be defined');
    }

    // A global role outside EXPOSABLE_GLOBAL_ROLE_NAMES — stands in for system
    // roles like the global Public role, which are never granted by hand.
    const [systemRole] = await db
      .insert(accessRoles)
      .values({
        name: `System Role ${task.id}`,
        profileId: null,
      })
      .returning();

    onTestFinished(async () => {
      if (systemRole) {
        await db.delete(accessRoles).where(eq(accessRoles.id, systemRole.id));
      }
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.updateUserRoles({
        profileUserId: memberUser.profileUserId,
        roleIds: [systemRole!.id],
      }),
    ).rejects.toMatchObject({
      cause: { name: 'CommonError' },
    });

    // The member's existing roles are untouched
    const unchangedUser = await db.query.profileUsers.findFirst({
      where: { id: memberUser.profileUserId },
      with: {
        roles: { with: { accessRole: true } },
      },
    });
    expect(unchangedUser?.roles).toHaveLength(1);
    expect(unchangedUser?.roles[0]?.accessRole.id).toBe(ROLES.MEMBER.id);
  });

  it('should support multiple roles and sync correctly', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { adminUser, memberUsers } = await testData.createProfile({
      users: { admin: 1, member: 1 },
    });

    const memberUser = memberUsers[0];
    if (!memberUser) {
      throw new Error('Expected memberUser to be defined');
    }

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Verify member starts with one role (MEMBER)
    const initialUser = await db.query.profileUsers.findFirst({
      where: { id: memberUser.profileUserId },
      with: {
        roles: {
          with: {
            accessRole: true,
          },
        },
      },
    });

    expect(initialUser?.roles).toHaveLength(1);
    expect(initialUser?.roles[0]?.accessRole.id).toBe(ROLES.MEMBER.id);

    // Add ADMIN role while keeping MEMBER role
    await caller.updateUserRoles({
      profileUserId: memberUser.profileUserId,
      roleIds: [ROLES.MEMBER.id, ROLES.ADMIN.id],
    });

    // Verify user now has both roles
    const userWithBothRoles = await db.query.profileUsers.findFirst({
      where: { id: memberUser.profileUserId },
      with: {
        roles: {
          with: {
            accessRole: true,
          },
        },
      },
    });

    expect(userWithBothRoles?.roles).toHaveLength(2);
    const roleIds = userWithBothRoles?.roles.map((r) => r.accessRole.id);
    expect(roleIds).toContain(ROLES.MEMBER.id);
    expect(roleIds).toContain(ROLES.ADMIN.id);

    // Remove MEMBER role, keeping only ADMIN
    await caller.updateUserRoles({
      profileUserId: memberUser.profileUserId,
      roleIds: [ROLES.ADMIN.id],
    });

    // Verify user now has only ADMIN role
    const userWithAdminOnly = await db.query.profileUsers.findFirst({
      where: { id: memberUser.profileUserId },
      with: {
        roles: {
          with: {
            accessRole: true,
          },
        },
      },
    });

    expect(userWithAdminOnly?.roles).toHaveLength(1);
    expect(userWithAdminOnly?.roles[0]?.accessRole.id).toBe(ROLES.ADMIN.id);
  });

  it('should reject demoting the profile owner from admin', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    // Promote the admin to owner of the profile. The test data manager seeds
    // the admin role but not isOwner; this models the production case where a
    // process owner is also its admin.
    await db
      .update(profileUsers)
      .set({ isOwner: true })
      .where(eq(profileUsers.id, adminUser.profileUserId));

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.updateUserRoles({
        profileUserId: adminUser.profileUserId,
        roleIds: [ROLES.MEMBER.id],
      }),
    ).rejects.toMatchObject({
      cause: { name: 'ValidationError' },
    });

    // Confirm the role was not changed — the admin role should still be there.
    const unchanged = await db.query.profileUsers.findFirst({
      where: { id: adminUser.profileUserId },
      with: { roles: true },
    });
    expect(unchanged?.roles).toHaveLength(1);
    expect(unchanged?.roles[0]?.accessRoleId).toBe(ROLES.ADMIN.id);
  });

  it('should fail when non-admin tries to update roles', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { memberUsers } = await testData.createProfile({
      users: { admin: 1, member: 2 },
      profileName: 'Role Update Test',
    });

    const memberUser1 = memberUsers[0];
    const memberUser2 = memberUsers[1];
    if (!memberUser1 || !memberUser2) {
      throw new Error('Expected memberUser1 and memberUser2 to be defined');
    }

    const { session } = await createIsolatedSession(memberUser1.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.updateUserRoles({
        profileUserId: memberUser2.profileUserId,
        roleIds: [ROLES.ADMIN.id],
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});

import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating';

describeAccessTierGating('profile.updateUserRoles', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.profile.updateUserRoles({
        profileUserId: '00000000-0000-0000-0000-000000000000',
        roleIds: ['00000000-0000-0000-0000-000000000000'],
      }),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.profile.updateUserRoles({
          profileUserId: '00000000-0000-0000-0000-000000000000',
          roleIds: ['00000000-0000-0000-0000-000000000000'],
        }),
        'anon',
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'rejects user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectFailsAccessTierGate(
        caller.profile.updateUserRoles({
          profileUserId: '00000000-0000-0000-0000-000000000000',
          roleIds: ['00000000-0000-0000-0000-000000000000'],
        }),
        'user',
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.profile.updateUserRoles({
          profileUserId: '00000000-0000-0000-0000-000000000000',
          roleIds: ['00000000-0000-0000-0000-000000000000'],
        }),
      );
    },
  ),
});
