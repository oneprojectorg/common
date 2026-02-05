import { db } from '@op/db/client';
import { allowList } from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { event } from '@op/events';
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

describe.concurrent('Profile Invite Integration Tests', () => {
  const createCaller = createCallerFactory(inviteProfileUserRouter);

  it('should create a pending invite for existing user (not add them directly)', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    // Create a standalone user to be invited
    const standaloneUser = await testData.createStandaloneUser();
    testData.trackProfileInvite(standaloneUser.email, profile.id);

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.invite({
      invitations: [{ email: standaloneUser.email, roleId: ROLES.MEMBER.id }],
      profileId: profile.id,
    });

    // Verify result
    expect(result.success).toBe(true);
    expect(result.details.successful).toContain(
      standaloneUser.email.toLowerCase(),
    );
    expect(result.details.failed).toHaveLength(0);

    // Verify profile_invites record was created
    const invite = await db._query.profileInvites.findFirst({
      where: (table, { eq, and, isNull }) =>
        and(
          eq(table.profileId, profile.id),
          eq(table.email, standaloneUser.email.toLowerCase()),
          isNull(table.acceptedOn),
        ),
    });

    expect(invite).toBeDefined();
    expect(invite?.accessRoleId).toBe(ROLES.MEMBER.id);

    // Verify user was NOT added to profileUsers directly
    const profileUser = await db._query.profileUsers.findFirst({
      where: (table, { eq, and }) =>
        and(
          eq(table.profileId, profile.id),
          eq(table.email, standaloneUser.email.toLowerCase()),
        ),
    });

    expect(profileUser).toBeUndefined();
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

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.invite({
      invitations: [{ email: memberUser.email, roleId: ROLES.MEMBER.id }],
      profileId: profile.id,
    });

    // Should fail because user is already a member
    expect(result.success).toBe(false);
    expect(result.details.successful).toHaveLength(0);
    expect(result.details.failed).toHaveLength(1);
    expect(result.details.failed[0]?.reason).toContain('already a member');
  });

  it('should create invite for new email and add to allowList', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    // Generate a new email that doesn't exist in the system
    const newEmail = `new-invite-user-${task.id}@oneproject.org`;
    testData.trackAllowListEmail(newEmail);
    testData.trackProfileInvite(newEmail, profile.id);

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.invite({
      invitations: [{ email: newEmail, roleId: ROLES.MEMBER.id }],
      profileId: profile.id,
    });

    expect(result.success).toBe(true);
    expect(result.details.successful).toContain(newEmail.toLowerCase());

    // Verify the allowList entry was created (for new users who need to sign up)
    const allowListEntry = await db._query.allowList.findFirst({
      where: (table, { eq }) => eq(table.email, newEmail.toLowerCase()),
    });

    expect(allowListEntry).toBeDefined();

    // Verify profile_invites record was created
    const invite = await db._query.profileInvites.findFirst({
      where: (table, { eq, and, isNull }) =>
        and(
          eq(table.profileId, profile.id),
          eq(table.email, newEmail.toLowerCase()),
          isNull(table.acceptedOn),
        ),
    });

    expect(invite).toBeDefined();
    expect(invite?.accessRoleId).toBe(ROLES.MEMBER.id);
  });

  it('should fail when user already has a pending invite', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    // Create a standalone user to be invited
    const standaloneUser = await testData.createStandaloneUser();
    testData.trackProfileInvite(standaloneUser.email, profile.id);

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // First invite should succeed
    const firstResult = await caller.invite({
      invitations: [{ email: standaloneUser.email, roleId: ROLES.MEMBER.id }],
      profileId: profile.id,
    });

    expect(firstResult.success).toBe(true);

    // Second invite should fail
    const secondResult = await caller.invite({
      invitations: [{ email: standaloneUser.email, roleId: ROLES.MEMBER.id }],
      profileId: profile.id,
    });

    expect(secondResult.success).toBe(false);
    expect(secondResult.details.failed).toHaveLength(1);
    expect(secondResult.details.failed[0]?.reason).toContain(
      'already has a pending invite',
    );
  });

  it('should not add existing user to allowList', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    // Create a standalone user to be invited
    const standaloneUser = await testData.createStandaloneUser();
    testData.trackProfileInvite(standaloneUser.email, profile.id);

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await caller.invite({
      invitations: [{ email: standaloneUser.email, roleId: ROLES.MEMBER.id }],
      profileId: profile.id,
    });

    // Verify existing user was NOT added to allowList (they already have an account)
    const allowListEntry = await db._query.allowList.findFirst({
      where: (table, { eq }) =>
        eq(table.email, standaloneUser.email.toLowerCase()),
    });

    expect(allowListEntry).toBeUndefined();
  });

  it('should handle multiple invitations with mixed results', async ({
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

    // Create a standalone user to be invited
    const standaloneUser = await testData.createStandaloneUser();
    testData.trackProfileInvite(standaloneUser.email, profile.id);

    // Generate a new email that doesn't exist
    const newEmail = `new-multi-${task.id}@oneproject.org`;
    testData.trackAllowListEmail(newEmail);
    testData.trackProfileInvite(newEmail, profile.id);

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.invite({
      invitations: [
        { email: standaloneUser.email, roleId: ROLES.MEMBER.id }, // Should succeed
        { email: memberUser.email, roleId: ROLES.MEMBER.id }, // Should fail - already a member
        { email: newEmail, roleId: ROLES.MEMBER.id }, // Should succeed
      ],
      profileId: profile.id,
    });

    // 2 successful, 1 failed
    expect(result.success).toBe(true);
    expect(result.details.successful).toHaveLength(2);
    expect(result.details.successful).toContain(
      standaloneUser.email.toLowerCase(),
    );
    expect(result.details.successful).toContain(newEmail.toLowerCase());
    expect(result.details.failed).toHaveLength(1);
    expect(result.details.failed[0]?.email).toBe(
      memberUser.email.toLowerCase(),
    );
    expect(result.details.failed[0]?.reason).toContain('already a member');
  });

  it('should support batch input with per-user role assignment', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    // Create two standalone users to be invited
    const user1 = await testData.createStandaloneUser();
    const user2 = await testData.createStandaloneUser();
    testData.trackProfileInvite(user1.email, profile.id);
    testData.trackProfileInvite(user2.email, profile.id);

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Use batch format: user1 as ADMIN, user2 as MEMBER
    const result = await caller.invite({
      invitations: [
        { email: user1.email, roleId: ROLES.ADMIN.id },
        { email: user2.email, roleId: ROLES.MEMBER.id },
      ],
      profileId: profile.id,
    });

    expect(result.success).toBe(true);
    expect(result.details.successful).toHaveLength(2);
    expect(result.details.successful).toContain(user1.email.toLowerCase());
    expect(result.details.successful).toContain(user2.email.toLowerCase());

    // Verify each invite was created with the correct role
    const invite1 = await db._query.profileInvites.findFirst({
      where: (table, { eq, and, isNull }) =>
        and(
          eq(table.profileId, profile.id),
          eq(table.email, user1.email.toLowerCase()),
          isNull(table.acceptedOn),
        ),
    });

    const invite2 = await db._query.profileInvites.findFirst({
      where: (table, { eq, and, isNull }) =>
        and(
          eq(table.profileId, profile.id),
          eq(table.email, user2.email.toLowerCase()),
          isNull(table.acceptedOn),
        ),
    });

    expect(invite1).toBeDefined();
    expect(invite1?.accessRoleId).toBe(ROLES.ADMIN.id);

    expect(invite2).toBeDefined();
    expect(invite2?.accessRoleId).toBe(ROLES.MEMBER.id);
  });

  it('should fail with empty invitations array', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.invite({
        invitations: [],
        profileId: profile.id,
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('should fail with invalid roleId', async ({ task, onTestFinished }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    const standaloneUser = await testData.createStandaloneUser();

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const invalidRoleId = '00000000-0000-0000-0000-000000000000';

    await expect(
      caller.invite({
        invitations: [{ email: standaloneUser.email, roleId: invalidRoleId }],
        profileId: profile.id,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'CommonError' },
    });
  });

  it('should fail when user is not associated with the profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    // Create a profile but we'll use a different user to call invite
    const { profile } = await testData.createProfile({
      users: { admin: 1 },
    });

    // Create a standalone user who is NOT a member of the profile
    const outsideUser = await testData.createStandaloneUser();
    const targetUser = await testData.createStandaloneUser();

    const { session } = await createIsolatedSession(outsideUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.invite({
        invitations: [{ email: targetUser.email, roleId: ROLES.MEMBER.id }],
        profileId: profile.id,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
  });

  it('should fail when user lacks ADMIN permission', async ({
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

    const targetUser = await testData.createStandaloneUser();

    // Login as member (not admin)
    const { session } = await createIsolatedSession(memberUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.invite({
        invitations: [{ email: targetUser.email, roleId: ROLES.MEMBER.id }],
        profileId: profile.id,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AccessControlException' },
    });
  });

  it('should pass personalMessage to the event', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    const standaloneUser = await testData.createStandaloneUser();
    testData.trackProfileInvite(standaloneUser.email, profile.id);

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const personalMessage = 'Welcome to our team!';

    // Clear previous mock calls
    vi.mocked(event.send).mockClear();

    const result = await caller.invite({
      invitations: [{ email: standaloneUser.email, roleId: ROLES.MEMBER.id }],
      profileId: profile.id,
      personalMessage,
    });

    expect(result.success).toBe(true);

    // Verify event.send was called with the personalMessage
    expect(event.send).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          invitations: expect.arrayContaining([
            expect.objectContaining({
              email: standaloneUser.email.toLowerCase(),
              personalMessage,
            }),
          ]),
        }),
      }),
    );
  });

  it('should fail with invalid profileId', async ({ task, onTestFinished }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    // Create a profile just to get an admin user with a session
    const { adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    const standaloneUser = await testData.createStandaloneUser();

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const invalidProfileId = '00000000-0000-0000-0000-000000000000';

    await expect(
      caller.invite({
        invitations: [{ email: standaloneUser.email, roleId: ROLES.MEMBER.id }],
        profileId: invalidProfileId,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'NotFoundError' },
    });
  });

  it('should not duplicate allowList entry for new user already on allowList', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    // Create a new email and manually add to allowList first
    const newEmail = `pre-allowed-${task.id}@oneproject.org`;
    testData.trackAllowListEmail(newEmail);
    testData.trackProfileInvite(newEmail, profile.id);

    // Pre-add to allowList
    await db.insert(allowList).values({
      email: newEmail.toLowerCase(),
      organizationId: null,
      metadata: null,
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Invite should succeed without duplicating allowList entry
    const result = await caller.invite({
      invitations: [{ email: newEmail, roleId: ROLES.MEMBER.id }],
      profileId: profile.id,
    });

    expect(result.success).toBe(true);
    expect(result.details.successful).toContain(newEmail.toLowerCase());

    // Verify only one allowList entry exists (no duplicate)
    const allowListEntries = await db._query.allowList.findMany({
      where: (table, { eq }) => eq(table.email, newEmail.toLowerCase()),
    });

    expect(allowListEntries).toHaveLength(1);
  });

  it('should return existingUserAuthIds for cache invalidation', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    // Create a standalone user (existing in the system but not in profile)
    const existingUser = await testData.createStandaloneUser();
    testData.trackProfileInvite(existingUser.email, profile.id);

    // Create a new email (doesn't exist in system)
    const newEmail = `new-user-${task.id}@oneproject.org`;
    testData.trackAllowListEmail(newEmail);
    testData.trackProfileInvite(newEmail, profile.id);

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.invite({
      invitations: [
        { email: existingUser.email, roleId: ROLES.MEMBER.id },
        { email: newEmail, roleId: ROLES.MEMBER.id },
      ],
      profileId: profile.id,
    });

    expect(result.success).toBe(true);
    expect(result.details.successful).toHaveLength(2);

    // existingUserAuthIds should only contain the existing user's authUserId
    expect(result.details.existingUserAuthIds).toHaveLength(1);
    expect(result.details.existingUserAuthIds[0]).toBe(existingUser.authUserId);
  });
});
