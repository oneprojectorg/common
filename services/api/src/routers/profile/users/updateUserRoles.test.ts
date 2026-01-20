import { db } from '@op/db/client';
import { profileUsers } from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';

import { TestProfileUserDataManager } from '../../../test/helpers/TestProfileUserDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';
import { usersRouter } from './index';

// Mock the event system to avoid Inngest API calls in tests
vi.mock('@op/events', async () => {
  const actual = await vi.importActual('@op/events');
  return {
    ...actual,
    event: {
      send: vi.fn().mockResolvedValue({ ids: ['mock-event-id'] }),
    },
  };
});

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
    const updatedUser = await db._query.profileUsers.findFirst({
      where: eq(profileUsers.id, memberUser.profileUserId),
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
    const initialUser = await db._query.profileUsers.findFirst({
      where: eq(profileUsers.id, memberUser.profileUserId),
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
    const userWithBothRoles = await db._query.profileUsers.findFirst({
      where: eq(profileUsers.id, memberUser.profileUserId),
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
    const userWithAdminOnly = await db._query.profileUsers.findFirst({
      where: eq(profileUsers.id, memberUser.profileUserId),
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
    ).rejects.toThrow(/not authenticated/i);
  });
});
