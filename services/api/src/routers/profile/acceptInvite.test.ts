import { db } from '@op/db/client';
import { EntityType, profileInvites } from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { describe, expect, it } from 'vitest';

import { TestProfileUserDataManager } from '../../test/helpers/TestProfileUserDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';
import profileRouter from './index';

describe.concurrent('profile.acceptInvite', () => {
  const createCaller = createCallerFactory(profileRouter);

  it('should successfully accept a valid pending invite', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);

    // Create profile with an admin user (the inviter)
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    // Create a standalone user who will be invited
    const invitee = await testData.createStandaloneUser();

    // Create a pending invite for the invitee
    const [invite] = await db
      .insert(profileInvites)
      .values({
        email: invitee.email,
        profileId: profile.id,
        profileEntityType: EntityType.ORG,
        accessRoleId: ROLES.MEMBER.id,
        invitedBy: adminUser.userProfileId,
      })
      .returning();

    if (!invite) {
      throw new Error('Failed to create invite');
    }

    // Track invite for cleanup
    testData.trackProfileInvite(invitee.email, profile.id);

    // Accept the invite as the invitee
    const { session } = await createIsolatedSession(invitee.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.acceptInvite({
      inviteId: invite.id,
    });

    // Verify the profileUser was created
    expect(result).toBeDefined();
    expect(result.profileId).toBe(profile.id);
    expect(result.authUserId).toBe(invitee.authUserId);
    expect(result.email).toBe(invitee.email);

    // Verify the role was assigned
    const profileUserWithRoles = await db.query.profileUsers.findFirst({
      where: { id: result.id },
      with: {
        roles: {
          with: {
            accessRole: true,
          },
        },
      },
    });

    expect(profileUserWithRoles?.roles).toHaveLength(1);
    expect(profileUserWithRoles?.roles[0]?.accessRole.id).toBe(ROLES.MEMBER.id);

    // Verify the invite was marked as accepted
    const updatedInvite = await db.query.profileInvites.findFirst({
      where: { id: invite.id },
    });

    expect(updatedInvite?.acceptedOn).not.toBeNull();
  });

  it('should fail when invite does not exist', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);

    // Create a standalone user
    const user = await testData.createStandaloneUser();

    // Try to accept a non-existent invite
    const { session } = await createIsolatedSession(user.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.acceptInvite({
        inviteId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toMatchObject({
      cause: {
        name: 'NotFoundError',
      },
    });
  });

  it('should fail when invite is already accepted', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);

    // Create profile with admin
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    // Create a standalone user
    const user = await testData.createStandaloneUser();

    // Create an already-accepted invite
    const [invite] = await db
      .insert(profileInvites)
      .values({
        email: user.email,
        profileId: profile.id,
        profileEntityType: EntityType.ORG,
        accessRoleId: ROLES.MEMBER.id,
        invitedBy: adminUser.userProfileId,
        acceptedOn: new Date().toISOString(), // Already accepted
      })
      .returning();

    if (!invite) {
      throw new Error('Failed to create invite');
    }

    testData.trackProfileInvite(user.email, profile.id);

    // Try to accept the already-accepted invite
    const { session } = await createIsolatedSession(user.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.acceptInvite({
        inviteId: invite.id,
      }),
    ).rejects.toMatchObject({
      cause: {
        name: 'ConflictError',
      },
    });
  });

  it('should fail when user email does not match invite email', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);

    // Create profile with admin
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    // Create a user who will try to accept the invite
    const user = await testData.createStandaloneUser();

    // Create invite for a different email
    const [invite] = await db
      .insert(profileInvites)
      .values({
        email: 'different-email@oneproject.org',
        profileId: profile.id,
        profileEntityType: EntityType.ORG,
        accessRoleId: ROLES.MEMBER.id,
        invitedBy: adminUser.userProfileId,
      })
      .returning();

    if (!invite) {
      throw new Error('Failed to create invite');
    }

    testData.trackProfileInvite('different-email@oneproject.org', profile.id);

    // Try to accept an invite meant for a different email
    const { session } = await createIsolatedSession(user.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.acceptInvite({
        inviteId: invite.id,
      }),
    ).rejects.toMatchObject({
      cause: {
        name: 'UnauthorizedError',
      },
    });
  });

  it('should fail when user is already a member of the profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);

    // Create profile with an existing member
    const { profile, adminUser, memberUsers } = await testData.createProfile({
      users: { admin: 1, member: 1 },
    });

    const existingMember = memberUsers[0];
    if (!existingMember) {
      throw new Error('Failed to create member user');
    }

    // Create invite for the existing member (for a different/upgraded role)
    const [invite] = await db
      .insert(profileInvites)
      .values({
        email: existingMember.email,
        profileId: profile.id,
        profileEntityType: EntityType.ORG,
        accessRoleId: ROLES.ADMIN.id, // Try to upgrade to admin
        invitedBy: adminUser.userProfileId,
      })
      .returning();

    if (!invite) {
      throw new Error('Failed to create invite');
    }

    testData.trackProfileInvite(existingMember.email, profile.id);

    // Try to accept invite when already a member
    const { session } = await createIsolatedSession(existingMember.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.acceptInvite({
        inviteId: invite.id,
      }),
    ).rejects.toMatchObject({
      cause: {
        name: 'CommonError',
      },
    });
  });

  it('should handle case-insensitive email matching', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);

    // Create profile with admin
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    // Create a standalone user (email will be lowercase)
    const invitee = await testData.createStandaloneUser();

    // Create invite with uppercase email
    const uppercaseEmail = invitee.email.toUpperCase();
    const [invite] = await db
      .insert(profileInvites)
      .values({
        email: uppercaseEmail,
        profileId: profile.id,
        profileEntityType: EntityType.ORG,
        accessRoleId: ROLES.MEMBER.id,
        invitedBy: adminUser.userProfileId,
      })
      .returning();

    if (!invite) {
      throw new Error('Failed to create invite');
    }

    testData.trackProfileInvite(uppercaseEmail, profile.id);

    // Accept invite - should work despite case difference
    const { session } = await createIsolatedSession(invitee.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.acceptInvite({
      inviteId: invite.id,
    });

    expect(result).toBeDefined();
    expect(result.profileId).toBe(profile.id);
  });

  it('should assign the correct role from the invite', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);

    // Create profile with admin
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    // Create a standalone user
    const invitee = await testData.createStandaloneUser();

    // Create invite with ADMIN role
    const [invite] = await db
      .insert(profileInvites)
      .values({
        email: invitee.email,
        profileId: profile.id,
        profileEntityType: EntityType.ORG,
        accessRoleId: ROLES.ADMIN.id, // Invite as admin
        invitedBy: adminUser.userProfileId,
      })
      .returning();

    if (!invite) {
      throw new Error('Failed to create invite');
    }

    testData.trackProfileInvite(invitee.email, profile.id);

    // Accept the invite
    const { session } = await createIsolatedSession(invitee.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.acceptInvite({
      inviteId: invite.id,
    });

    // Verify the ADMIN role was assigned
    const profileUserWithRoles = await db.query.profileUsers.findFirst({
      where: { id: result.id },
      with: {
        roles: {
          with: {
            accessRole: true,
          },
        },
      },
    });

    expect(profileUserWithRoles?.roles).toHaveLength(1);
    expect(profileUserWithRoles?.roles[0]?.accessRole.id).toBe(ROLES.ADMIN.id);
  });
});
