import { db } from '@op/db/client';
import { ROLES } from '@op/db/seedData/accessControl';
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

describe.concurrent('profile.users.addUser', () => {
  const createCaller = createCallerFactory(usersRouter);

  it('should create an invite for an existing user (not add them directly)', async ({
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

    const result = await caller.addUser({
      profileId: profile.id,
      inviteeEmail: standaloneUser.email,
      roleIdsToAssign: [ROLES.MEMBER.id],
    });

    // Should return the invited email (invite created, not added directly)
    expect(result).toBeDefined();
    expect(result.email).toBe(standaloneUser.email.toLowerCase());

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

  it('should fail when user is already a member', async ({
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

    await expect(
      caller.addUser({
        profileId: profile.id,
        inviteeEmail: memberUser.email,
        roleIdsToAssign: [ROLES.MEMBER.id],
      }),
    ).rejects.toThrow(/already a member/i);
  });

  it('should fail when non-admin tries to add user', async ({
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

    const standaloneUser = await testData.createStandaloneUser();

    const { session } = await createIsolatedSession(memberUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.addUser({
        profileId: profile.id,
        inviteeEmail: standaloneUser.email,
        roleIdsToAssign: [ROLES.MEMBER.id],
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });

  it('should create invite for new email with personalMessage and add to allowList', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    // Generate a new email that doesn't exist in the system
    const newEmail = `new-user-${task.id}@oneproject.org`;
    testData.trackAllowListEmail(newEmail);
    testData.trackProfileInvite(newEmail, profile.id);

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const personalMessage = 'Welcome to our team!';
    const result = await caller.addUser({
      profileId: profile.id,
      inviteeEmail: newEmail,
      roleIdsToAssign: [ROLES.MEMBER.id],
      personalMessage,
    });

    expect(result).toBeDefined();
    expect(result.email).toBe(newEmail.toLowerCase());

    // Verify the allowList entry was created (for new users who need to sign up)
    const allowListEntry = await db._query.allowList.findFirst({
      where: (table, { eq }) => eq(table.email, newEmail.toLowerCase()),
    });

    expect(allowListEntry).toBeDefined();

    // Verify profile_invites record was created with the personalMessage
    const invite = await db._query.profileInvites.findFirst({
      where: (table, { eq, and, isNull }) =>
        and(
          eq(table.profileId, profile.id),
          eq(table.email, newEmail.toLowerCase()),
          isNull(table.acceptedOn),
        ),
    });

    expect(invite).toBeDefined();
    expect(invite?.message).toBe(personalMessage);
    expect(invite?.accessRoleId).toBe(ROLES.MEMBER.id);
  });

  it('should fail when existing user already has a pending invite', async ({
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
    const result = await caller.addUser({
      profileId: profile.id,
      inviteeEmail: standaloneUser.email,
      roleIdsToAssign: [ROLES.MEMBER.id],
    });

    expect(result.email).toBe(standaloneUser.email.toLowerCase());

    // Second invite should fail
    await expect(
      caller.addUser({
        profileId: profile.id,
        inviteeEmail: standaloneUser.email,
        roleIdsToAssign: [ROLES.MEMBER.id],
      }),
    ).rejects.toThrow(/already has a pending invite/i);
  });

  it('should fail when new user already has a pending invite', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    // Generate a new email that doesn't exist in the system
    const newEmail = `new-user-pending-${task.id}@oneproject.org`;
    testData.trackAllowListEmail(newEmail);
    testData.trackProfileInvite(newEmail, profile.id);

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // First invite should succeed
    const result = await caller.addUser({
      profileId: profile.id,
      inviteeEmail: newEmail,
      roleIdsToAssign: [ROLES.MEMBER.id],
    });

    expect(result.email).toBe(newEmail.toLowerCase());

    // Second invite should fail
    await expect(
      caller.addUser({
        profileId: profile.id,
        inviteeEmail: newEmail,
        roleIdsToAssign: [ROLES.MEMBER.id],
      }),
    ).rejects.toThrow(/already has a pending invite/i);
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

    await caller.addUser({
      profileId: profile.id,
      inviteeEmail: standaloneUser.email,
      roleIdsToAssign: [ROLES.MEMBER.id],
    });

    // Verify existing user was NOT added to allowList (they already have an account)
    const allowListEntry = await db._query.allowList.findFirst({
      where: (table, { eq }) =>
        eq(table.email, standaloneUser.email.toLowerCase()),
    });

    expect(allowListEntry).toBeUndefined();
  });
});
