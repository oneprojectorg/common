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

  it('should add a user to the profile', async ({ task, onTestFinished }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    // Create a standalone user to be added
    const standaloneUser = await testData.createStandaloneUser();

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.addUser({
      profileId: profile.id,
      email: standaloneUser.email,
      roleIds: [ROLES.MEMBER.id],
    });

    expect(result).toBeDefined();
    expect(result.email).toBe(standaloneUser.email);

    // Verify user was added to the profile
    const addedUser = await db.query.profileUsers.findFirst({
      where: (table, { eq, and }) =>
        and(
          eq(table.profileId, profile.id),
          eq(table.email, standaloneUser.email),
        ),
      with: {
        roles: {
          with: {
            accessRole: true,
          },
        },
      },
    });

    expect(addedUser).toBeDefined();
    expect(addedUser?.roles).toHaveLength(1);
    expect(addedUser?.roles[0]?.accessRole.id).toBe(ROLES.MEMBER.id);
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
        email: memberUser.email,
        roleIds: [ROLES.MEMBER.id],
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
        email: standaloneUser.email,
        roleIds: [ROLES.MEMBER.id],
      }),
    ).rejects.toThrow(/not authenticated/i);
  });

  it('should add new email to allowList with personalMessage', async ({
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

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const personalMessage = 'Welcome to our team!';
    const result = await caller.addUser({
      profileId: profile.id,
      email: newEmail,
      roleIds: [ROLES.MEMBER.id],
      personalMessage,
    });

    expect(result).toBeDefined();
    expect(result.email).toBe(newEmail.toLowerCase());

    // Verify the allowList entry was created with the personalMessage
    const allowListEntry = await db.query.allowList.findFirst({
      where: (table, { eq }) => eq(table.email, newEmail.toLowerCase()),
    });

    expect(allowListEntry).toBeDefined();
    expect(allowListEntry?.metadata).toBeDefined();

    const metadata = allowListEntry?.metadata as {
      personalMessage?: string;
      inviteType?: string;
      roleIds?: string[];
      profileId?: string;
    };
    expect(metadata.personalMessage).toBe(personalMessage);
    expect(metadata.inviteType).toBe('profile');
    expect(metadata.roleIds).toEqual([ROLES.MEMBER.id]);
    expect(metadata.profileId).toBe(profile.id);
  });
});
