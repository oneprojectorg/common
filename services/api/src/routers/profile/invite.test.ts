import { db } from '@op/db/client';
import {
  accessRolePermissionsOnAccessZones,
  accessRoles,
  allowList,
  profileUserToAccessRoles,
} from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { event } from '@op/events';
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

  it('should fail when user lacks ADMIN and INVITE_MEMBERS permissions', async ({
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

    // Login as member (not admin, no INVITE_MEMBERS decision capability)
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

  it('should allow user with INVITE_MEMBERS decision capability to invite', async ({
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

    // Create a custom role with INVITE_MEMBERS decision capability (bit 6 = 64)
    const [inviterRole] = await db
      .insert(accessRoles)
      .values({
        name: `Inviter Role ${task.id}`,
        description: 'Can invite members via decision capability',
        profileId: profile.id,
      })
      .returning();

    onTestFinished(async () => {
      if (inviterRole) {
        await db.delete(accessRoles).where(eq(accessRoles.id, inviterRole.id));
      }
    });

    // Set INVITE_MEMBERS (64) decision bit on the decisions zone for this role
    const decisionsZone = await db._query.accessZones.findFirst({
      where: (table, { eq }) => eq(table.name, 'decisions'),
    });

    if (!decisionsZone) {
      throw new Error('Decisions zone not found');
    }

    await db.insert(accessRolePermissionsOnAccessZones).values({
      accessRoleId: inviterRole!.id,
      accessZoneId: decisionsZone.id,
      permission: 64, // INVITE_MEMBERS bit only
    });

    // Assign this role to the member user's profile user
    await db.insert(profileUserToAccessRoles).values({
      profileUserId: memberUser.profileUserId,
      accessRoleId: inviterRole!.id,
    });

    // Create a standalone user to be invited
    const targetUser = await testData.createStandaloneUser();
    testData.trackProfileInvite(targetUser.email, profile.id);

    // Login as the member user (who now has INVITE_MEMBERS capability)
    const { session } = await createIsolatedSession(memberUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.invite({
      invitations: [{ email: targetUser.email, roleId: ROLES.MEMBER.id }],
      profileId: profile.id,
    });

    expect(result.success).toBe(true);
    expect(result.details.successful).toContain(targetUser.email.toLowerCase());
  });

  // This test clears the global event.send mock, so it must run sequentially
  // to avoid race conditions with other tests
  it.sequential(
    'should pass personalMessage to the event',
    async ({ task, onTestFinished }) => {
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
    },
  );

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

  // This test modifies the global event.send mock, so it must run sequentially
  // to avoid race conditions with other tests
  it.sequential(
    'should rollback transaction when event.send fails',
    async ({ task, onTestFinished }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { profile, adminUser } = await testData.createProfile({
        users: { admin: 1 },
      });

      // Create a new email that doesn't exist in the system
      const newEmail = `rollback-test-${task.id}@oneproject.org`;
      // Track for defensive cleanup in case rollback fails
      testData.trackAllowListEmail(newEmail);
      testData.trackProfileInvite(newEmail, profile.id);

      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      // Mock event.send to throw an error for this test only
      vi.mocked(event.send).mockImplementationOnce(() => {
        throw new Error('Event send failed');
      });

      // The invite should fail
      await expect(
        caller.invite({
          invitations: [{ email: newEmail, roleId: ROLES.MEMBER.id }],
          profileId: profile.id,
        }),
      ).rejects.toThrow('Event send failed');

      // Restore the mock to default behavior
      vi.mocked(event.send).mockResolvedValue({ ids: ['mock-event-id'] });

      // Verify NO profileInvites record was created (transaction rolled back)
      const invite = await db._query.profileInvites.findFirst({
        where: (table, { eq, and }) =>
          and(
            eq(table.profileId, profile.id),
            eq(table.email, newEmail.toLowerCase()),
          ),
      });

      expect(invite).toBeUndefined();

      // Verify NO allowList entry was created (transaction rolled back)
      const allowListEntry = await db._query.allowList.findFirst({
        where: (table, { eq }) => eq(table.email, newEmail.toLowerCase()),
      });

      expect(allowListEntry).toBeUndefined();
    },
  );

  it('should reject duplicate emails in same batch via database constraint', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    // Create a standalone user to be invited
    const standaloneUser = await testData.createStandaloneUser();
    // Track for defensive cleanup in case transaction doesn't roll back
    testData.trackProfileInvite(standaloneUser.email, profile.id);

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Send same email twice in one request - DB unique constraint prevents this
    await expect(
      caller.invite({
        invitations: [
          { email: standaloneUser.email, roleId: ROLES.MEMBER.id },
          { email: standaloneUser.email, roleId: ROLES.ADMIN.id },
        ],
        profileId: profile.id,
      }),
    ).rejects.toThrow();

    // Verify no invite was created (transaction rolled back)
    const invites = await db._query.profileInvites.findMany({
      where: (table, { eq, and, isNull }) =>
        and(
          eq(table.profileId, profile.id),
          eq(table.email, standaloneUser.email.toLowerCase()),
          isNull(table.acceptedOn),
        ),
    });

    expect(invites).toHaveLength(0);
  });

  it('should normalize mixed case emails to lowercase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    // Use mixed case email
    const mixedCaseEmail = `Test.User.${task.id}@OneProject.ORG`;
    const normalizedEmail = mixedCaseEmail.toLowerCase();
    testData.trackAllowListEmail(normalizedEmail);
    testData.trackProfileInvite(normalizedEmail, profile.id);

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.invite({
      invitations: [{ email: mixedCaseEmail, roleId: ROLES.MEMBER.id }],
      profileId: profile.id,
    });

    expect(result.success).toBe(true);
    // Verify the returned successful email is lowercase
    expect(result.details.successful).toContain(normalizedEmail);
    expect(result.details.successful).not.toContain(mixedCaseEmail);

    // Verify the database record uses lowercase
    const invite = await db._query.profileInvites.findFirst({
      where: (table, { eq, and, isNull }) =>
        and(
          eq(table.profileId, profile.id),
          eq(table.email, normalizedEmail),
          isNull(table.acceptedOn),
        ),
    });

    expect(invite).toBeDefined();
    expect(invite?.email).toBe(normalizedEmail);

    // Verify allowList also uses lowercase
    const allowListEntry = await db._query.allowList.findFirst({
      where: (table, { eq }) => eq(table.email, normalizedEmail),
    });

    expect(allowListEntry).toBeDefined();
    expect(allowListEntry?.email).toBe(normalizedEmail);
  });

  it('should reject malformed email addresses', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Test with invalid email format
    await expect(
      caller.invite({
        invitations: [{ email: 'not-an-email', roleId: ROLES.MEMBER.id }],
        profileId: profile.id,
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });
});
