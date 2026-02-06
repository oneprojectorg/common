import { db } from '@op/db/client';
import { allowList } from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';

import { TestProfileUserDataManager } from '../../test/helpers/TestProfileUserDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';
import { inviteProfileUserRouter } from './invite';

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

describe('Profile Invite Integration Tests', () => {
  const createCaller = createCallerFactory(inviteProfileUserRouter);

  it('should add existing user to profile when invited', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    // Create a standalone user to be invited
    const invitee = await testData.createStandaloneUser();

    // Track the allowList entry that will be created by the invite
    testData.trackAllowListEmail(invitee.email);

    // Create session as admin and call invite endpoint
    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.invite({
      emails: [invitee.email],
      roleId: ROLES.MEMBER.id,
      profileId: profile.id,
    });

    // Verify result
    expect(result.success).toBe(true);
    expect(result.details.successful).toContain(invitee.email);
    expect(result.details.failed).toHaveLength(0);

    // Verify profileUser was created
    const createdProfileUser = await db._query.profileUsers.findFirst({
      where: (table, { eq, and }) =>
        and(
          eq(table.profileId, profile.id),
          eq(table.authUserId, invitee.authUserId),
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
    expect(createdProfileUser?.email).toBe(invitee.email);
    expect(createdProfileUser?.roles).toHaveLength(1);
    expect(createdProfileUser?.roles[0]?.accessRole.id).toBe(ROLES.MEMBER.id);
  });

  it('should fail when user is already a member of the profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser, memberUsers } = await testData.createProfile({
      users: { admin: 1, member: 1 },
    });

    const memberUser = memberUsers[0];
    if (!memberUser) {
      throw new Error('Expected memberUser to be defined');
    }

    // Try to invite existing member
    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.invite({
      emails: [memberUser.email],
      roleId: ROLES.MEMBER.id,
      profileId: profile.id,
    });

    // Should fail because user is already a member
    expect(result.success).toBe(false);
    expect(result.details.successful).toHaveLength(0);
    expect(result.details.failed).toHaveLength(1);
    expect(result.details.failed[0]?.reason).toContain('already a member');
  });

  it('should fail when non-admin tries to invite', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, memberUsers } = await testData.createProfile({
      users: { admin: 1, member: 1 },
    });

    const memberUser = memberUsers[0];
    if (!memberUser) {
      throw new Error('Expected memberUser to be defined');
    }

    // Create a standalone user to be invited
    const invitee = await testData.createStandaloneUser();

    // Create session as member (not admin) and try to invite
    const { session } = await createIsolatedSession(memberUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.invite({
        emails: [invitee.email],
        roleId: ROLES.MEMBER.id,
        profileId: profile.id,
      }),
    ).rejects.toThrow(/not authenticated/i);
  });

  it('should add new email to allowList when user does not exist', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    // Generate an email that doesn't exist in the system
    const newEmail = `new-user-${task.id}-${randomUUID().slice(0, 6)}@example.com`;

    // Track the allowList entry for cleanup
    testData.trackAllowListEmail(newEmail);

    // Create session as admin and invite the new email
    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.invite({
      emails: [newEmail],
      roleId: ROLES.MEMBER.id,
      profileId: profile.id,
    });

    // Should succeed - email added to allowList and invite sent
    expect(result.success).toBe(true);
    expect(result.details.successful).toContain(newEmail);
    expect(result.details.failed).toHaveLength(0);

    // Verify allowList entry was created
    const allowListEntry = await db._query.allowList.findFirst({
      where: eq(allowList.email, newEmail),
    });

    expect(allowListEntry).toBeDefined();
    expect(allowListEntry?.email).toBe(newEmail);
  });

  it('should fail when invalid roleId is provided', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    const invitee = await testData.createStandaloneUser();

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Use a random UUID that doesn't correspond to any role
    const invalidRoleId = randomUUID();

    await expect(
      caller.invite({
        emails: [invitee.email],
        roleId: invalidRoleId,
        profileId: profile.id,
      }),
    ).rejects.toThrow(/Invalid role/i);
  });

  it('should handle batch invites with partial success', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser, memberUsers } = await testData.createProfile({
      users: { admin: 1, member: 1 },
    });

    const existingMember = memberUsers[0];
    if (!existingMember) {
      throw new Error('Expected existingMember to be defined');
    }

    // Create a new user who can be successfully invited
    const newInvitee = await testData.createStandaloneUser();
    testData.trackAllowListEmail(newInvitee.email);

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Invite both: one should succeed (newInvitee), one should fail (existingMember)
    const result = await caller.invite({
      emails: [newInvitee.email, existingMember.email],
      roleId: ROLES.MEMBER.id,
      profileId: profile.id,
    });

    // Partial success - one succeeded, one failed
    expect(result.success).toBe(true); // At least one succeeded
    expect(result.details.successful).toContain(newInvitee.email);
    expect(result.details.successful).not.toContain(existingMember.email);
    expect(result.details.failed).toHaveLength(1);
    expect(result.details.failed[0]?.email).toBe(existingMember.email);
    expect(result.details.failed[0]?.reason).toContain('already a member');
  });
});
