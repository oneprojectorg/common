import { db } from '@op/db/client';
import {
  accessRoles,
  profileUserToAccessRoles,
  profileUsers,
  profiles,
  users,
} from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { createCallerFactory } from '../../trpcFactory';
import {
  createIsolatedSession,
  createTestContextWithSession,
  createTestUser,
  supabaseTestAdminClient,
} from '../../test/supabase-utils';
import { inviteProfileUserRouter } from './invite';

describe('Profile Invite Integration Tests', () => {
  const createCaller = createCallerFactory(inviteProfileUserRouter);

  it('should add existing user to profile when invited', async ({
    task,
    onTestFinished,
  }) => {
    const testId = task.id;

    // Track created resources for cleanup
    const createdProfileIds: string[] = [];
    const createdAuthUserIds: string[] = [];

    // Register cleanup
    onTestFinished(async () => {
      // Clean up profile users first (due to foreign keys)
      if (createdProfileIds.length > 0) {
        await db
          .delete(profileUsers)
          .where(eq(profileUsers.profileId, createdProfileIds[0]!));
      }

      // Clean up profiles
      for (const profileId of createdProfileIds) {
        await db.delete(profiles).where(eq(profiles.id, profileId));
      }

      // Clean up auth users
      for (const authUserId of createdAuthUserIds) {
        await supabaseTestAdminClient.auth.admin.deleteUser(authUserId);
        await db.delete(users).where(eq(users.authUserId, authUserId));
      }
    });

    // 1. Create a profile
    const [profile] = await db
      .insert(profiles)
      .values({
        name: `Test Profile ${testId}`,
        slug: `test-profile-${testId}-${randomUUID()}`,
      })
      .returning();

    if (!profile) {
      throw new Error('Failed to create profile');
    }
    createdProfileIds.push(profile.id);

    // 2. Create admin user who will send invites
    const adminEmail = `admin-${testId}@test.oneproject.org`;
    const adminAuthUser = await createTestUser(adminEmail).then(
      (res) => res.user,
    );

    if (!adminAuthUser) {
      throw new Error('Failed to create admin auth user');
    }
    createdAuthUserIds.push(adminAuthUser.id);

    // Wait for trigger to create user record, then fetch it
    const adminUserRecord = await db.query.users.findFirst({
      where: eq(users.authUserId, adminAuthUser.id),
    });

    if (!adminUserRecord) {
      throw new Error('Failed to find admin user record');
    }

    // Get admin role
    const adminRole = await db.query.accessRoles.findFirst({
      where: eq(accessRoles.name, ROLES.ADMIN.name),
    });

    if (!adminRole) {
      throw new Error('Admin role not found');
    }

    // Create admin as profileUser with admin role
    const [adminProfileUser] = await db
      .insert(profileUsers)
      .values({
        authUserId: adminAuthUser.id,
        profileId: profile.id,
        email: adminEmail,
        name: 'Admin User',
      })
      .returning();

    if (!adminProfileUser) {
      throw new Error('Failed to create admin profile user');
    }

    // Assign admin role to profile user
    await db.insert(profileUserToAccessRoles).values({
      profileUserId: adminProfileUser.id,
      accessRoleId: adminRole.id,
    });

    // 3. Create user to be invited
    const inviteeEmail = `invitee-${testId}@test.oneproject.org`;
    const inviteeAuthUser = await createTestUser(inviteeEmail).then(
      (res) => res.user,
    );

    if (!inviteeAuthUser) {
      throw new Error('Failed to create invitee auth user');
    }
    createdAuthUserIds.push(inviteeAuthUser.id);

    // Get member role for inviting
    const memberRole = await db.query.accessRoles.findFirst({
      where: eq(accessRoles.name, ROLES.MEMBER.name),
    });

    if (!memberRole) {
      throw new Error('Member role not found');
    }

    // 4. Create session as admin and call invite endpoint
    const { session } = await createIsolatedSession(adminEmail);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.invite({
      emails: [inviteeEmail],
      roleId: memberRole.id,
      profileId: profile.id,
    });

    // 5. Verify result
    expect(result.success).toBe(true);
    expect(result.details.successful).toContain(inviteeEmail);
    expect(result.details.failed).toHaveLength(0);

    // 6. Verify profileUser was created
    const createdProfileUser = await db.query.profileUsers.findFirst({
      where: (table, { eq, and }) =>
        and(
          eq(table.profileId, profile.id),
          eq(table.authUserId, inviteeAuthUser.id),
        ),
      with: {
        roles: {
          with: {
            accessRole: true,
          },
        },
      },
    });

    expect(createdProfileUser).toBeDefined();
    expect(createdProfileUser?.email).toBe(inviteeEmail);
    expect(createdProfileUser?.roles).toHaveLength(1);
    expect(createdProfileUser?.roles[0]?.accessRole.name).toBe(ROLES.MEMBER.name);
  });

  it('should fail when user is already a member of the profile', async ({
    task,
    onTestFinished,
  }) => {
    const testId = task.id;

    const createdProfileIds: string[] = [];
    const createdAuthUserIds: string[] = [];

    onTestFinished(async () => {
      if (createdProfileIds.length > 0) {
        await db
          .delete(profileUsers)
          .where(eq(profileUsers.profileId, createdProfileIds[0]!));
      }
      for (const profileId of createdProfileIds) {
        await db.delete(profiles).where(eq(profiles.id, profileId));
      }
      for (const authUserId of createdAuthUserIds) {
        await supabaseTestAdminClient.auth.admin.deleteUser(authUserId);
        await db.delete(users).where(eq(users.authUserId, authUserId));
      }
    });

    // Create profile
    const [profile] = await db
      .insert(profiles)
      .values({
        name: `Test Profile ${testId}`,
        slug: `test-profile-${testId}-${randomUUID()}`,
      })
      .returning();

    if (!profile) {
      throw new Error('Failed to create profile');
    }
    createdProfileIds.push(profile.id);

    // Create admin user
    const adminEmail = `admin-${testId}@test.oneproject.org`;
    const adminAuthUser = await createTestUser(adminEmail).then(
      (res) => res.user,
    );

    if (!adminAuthUser) {
      throw new Error('Failed to create admin auth user');
    }
    createdAuthUserIds.push(adminAuthUser.id);

    const adminRole = await db.query.accessRoles.findFirst({
      where: eq(accessRoles.name, ROLES.ADMIN.name),
    });

    if (!adminRole) {
      throw new Error('Admin role not found');
    }

    const [adminProfileUser] = await db
      .insert(profileUsers)
      .values({
        authUserId: adminAuthUser.id,
        profileId: profile.id,
        email: adminEmail,
        name: 'Admin User',
      })
      .returning();

    if (!adminProfileUser) {
      throw new Error('Failed to create admin profile user');
    }

    await db.insert(profileUserToAccessRoles).values({
      profileUserId: adminProfileUser.id,
      accessRoleId: adminRole.id,
    });

    // Create user who is already a member
    const memberEmail = `member-${testId}@test.oneproject.org`;
    const memberAuthUser = await createTestUser(memberEmail).then(
      (res) => res.user,
    );

    if (!memberAuthUser) {
      throw new Error('Failed to create member auth user');
    }
    createdAuthUserIds.push(memberAuthUser.id);

    const memberRole = await db.query.accessRoles.findFirst({
      where: eq(accessRoles.name, ROLES.MEMBER.name),
    });

    if (!memberRole) {
      throw new Error('Member role not found');
    }

    // Add them as existing member
    const [existingMember] = await db
      .insert(profileUsers)
      .values({
        authUserId: memberAuthUser.id,
        profileId: profile.id,
        email: memberEmail,
        name: 'Member User',
      })
      .returning();

    if (!existingMember) {
      throw new Error('Failed to create existing member');
    }

    await db.insert(profileUserToAccessRoles).values({
      profileUserId: existingMember.id,
      accessRoleId: memberRole.id,
    });

    // Try to invite existing member
    const { session } = await createIsolatedSession(adminEmail);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.invite({
      emails: [memberEmail],
      roleId: memberRole.id,
      profileId: profile.id,
    });

    // Should fail because user is already a member
    expect(result.success).toBe(false);
    expect(result.details.successful).toHaveLength(0);
    expect(result.details.failed).toHaveLength(1);
    expect(result.details.failed[0]?.reason).toContain('already a member');
  });
});
