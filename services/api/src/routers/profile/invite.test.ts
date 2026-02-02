import { db } from '@op/db/client';
import { ROLES } from '@op/db/seedData/accessControl';
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
      emails: [standaloneUser.email],
      roleId: ROLES.MEMBER.id,
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
      emails: [newEmail],
      roleId: ROLES.MEMBER.id,
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
      emails: [standaloneUser.email],
      roleId: ROLES.MEMBER.id,
      profileId: profile.id,
    });

    expect(firstResult.success).toBe(true);

    // Second invite should fail
    const secondResult = await caller.invite({
      emails: [standaloneUser.email],
      roleId: ROLES.MEMBER.id,
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
      emails: [standaloneUser.email],
      roleId: ROLES.MEMBER.id,
      profileId: profile.id,
    });

    // Verify existing user was NOT added to allowList (they already have an account)
    const allowListEntry = await db._query.allowList.findFirst({
      where: (table, { eq }) =>
        eq(table.email, standaloneUser.email.toLowerCase()),
    });

    expect(allowListEntry).toBeUndefined();
  });

  it('should handle multiple emails with mixed results', async ({
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
      emails: [
        standaloneUser.email, // Should succeed - existing user gets invite
        memberUser.email, // Should fail - already a member
        newEmail, // Should succeed - new user gets invite + allowList
      ],
      roleId: ROLES.MEMBER.id,
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
});
