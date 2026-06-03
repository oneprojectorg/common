import { db } from '@op/db/client';
import { profileUsers } from '@op/db/schema';
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

describe.concurrent('profile.users.removeUser', () => {
  const createCaller = createCallerFactory(usersRouter);

  it('should remove a user from the profile', async ({
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

    await caller.removeUser({
      profileUserId: memberUser.profileUserId,
    });

    // Verify user was removed
    const removedUser = await db.query.profileUsers.findFirst({
      where: { id: memberUser.profileUserId },
    });

    expect(removedUser).toBeUndefined();
  });

  it('should fail when trying to remove the profile owner', async ({
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

    // Mark the member as the profile owner
    await db
      .update(profileUsers)
      .set({ isOwner: true })
      .where(eq(profileUsers.id, memberUser.profileUserId));

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.removeUser({
        profileUserId: memberUser.profileUserId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });

  it('should fail when non-admin tries to remove user', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { memberUsers } = await testData.createProfile({
      users: { admin: 1, member: 2 },
      profileName: 'Remove User Test',
    });

    const memberUser1 = memberUsers[0];
    const memberUser2 = memberUsers[1];
    if (!memberUser1 || !memberUser2) {
      throw new Error('Expected memberUser1 and memberUser2 to be defined');
    }

    const { session } = await createIsolatedSession(memberUser1.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.removeUser({
        profileUserId: memberUser2.profileUserId,
      }),
    ).rejects.toThrow(/not authenticated/i);
  });
});

import {
  describeGating,
  expectFailsTierGate,
  expectPassesTierGate,
} from '../../../test/helpers/gating';

describeGating('profile.removeUser', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsTierGate(
      caller.profile.removeUser({
        profileUserId: '00000000-0000-0000-0000-000000000000',
      }),
      'none',
    );
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsTierGate(
      caller.profile.removeUser({
        profileUserId: '00000000-0000-0000-0000-000000000000',
      }),
      'anon',
    );
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expectFailsTierGate(
      caller.profile.removeUser({
        profileUserId: '00000000-0000-0000-0000-000000000000',
      }),
      'user',
    );
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesTierGate(
      caller.profile.removeUser({
        profileUserId: '00000000-0000-0000-0000-000000000000',
      }),
    );
  },
});
