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

describe.concurrent('profile.declineInvite', () => {
  const createCaller = createCallerFactory(profileRouter);

  it('should successfully decline a pending invite', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);

    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    const invitee = await testData.createStandaloneUser();

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

    testData.trackProfileInvite(invitee.email, profile.id);

    const { session } = await createIsolatedSession(invitee.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await caller.declineInvite({ inviteId: invite.id });

    // Verify the invite was hard-deleted
    const deletedInvite = await db.query.profileInvites.findFirst({
      where: { id: invite.id },
    });

    expect(deletedInvite).toBeUndefined();
  });

  it('should fail when invite does not exist', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);

    const user = await testData.createStandaloneUser();

    const { session } = await createIsolatedSession(user.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.declineInvite({
        inviteId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'NotFoundError' },
    });
  });

  it('should fail when invite is already accepted', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);

    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    const user = await testData.createStandaloneUser();

    const [invite] = await db
      .insert(profileInvites)
      .values({
        email: user.email,
        profileId: profile.id,
        profileEntityType: EntityType.ORG,
        accessRoleId: ROLES.MEMBER.id,
        invitedBy: adminUser.userProfileId,
        acceptedOn: new Date().toISOString(),
      })
      .returning();

    if (!invite) {
      throw new Error('Failed to create invite');
    }

    testData.trackProfileInvite(user.email, profile.id);

    const { session } = await createIsolatedSession(user.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.declineInvite({ inviteId: invite.id }),
    ).rejects.toMatchObject({
      cause: { name: 'NotFoundError' },
    });
  });

  it('should fail when user email does not match invite email', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);

    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    const wrongUser = await testData.createStandaloneUser();

    const [invite] = await db
      .insert(profileInvites)
      .values({
        email: 'someone-else@oneproject.org',
        profileId: profile.id,
        profileEntityType: EntityType.ORG,
        accessRoleId: ROLES.MEMBER.id,
        invitedBy: adminUser.userProfileId,
      })
      .returning();

    if (!invite) {
      throw new Error('Failed to create invite');
    }

    testData.trackProfileInvite('someone-else@oneproject.org', profile.id);

    const { session } = await createIsolatedSession(wrongUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.declineInvite({ inviteId: invite.id }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });

    // Verify the invite was NOT deleted
    const stillExists = await db.query.profileInvites.findFirst({
      where: { id: invite.id },
    });

    expect(stillExists).toBeDefined();
  });

  it('should handle case-insensitive email matching', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);

    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

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

    // Decline should work despite case difference
    const { session } = await createIsolatedSession(invitee.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await caller.declineInvite({ inviteId: invite.id });
  });
});
