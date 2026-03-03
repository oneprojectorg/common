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

describe.concurrent('profile.listProfileInvites', () => {
  const createCaller = createCallerFactory(profileRouter);

  it('should return pending invites with accessRoleId', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    // Create a pending invite
    const inviteeEmail = `invitee-${task.id}@oneproject.org`;
    testData.trackProfileInvite(inviteeEmail, profile.id);

    await db.insert(profileInvites).values({
      email: inviteeEmail,
      profileId: profile.id,
      profileEntityType: EntityType.ORG,
      accessRoleId: ROLES.MEMBER.id,
      invitedBy: adminUser.userProfileId,
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.listProfileInvites({
      profileId: profile.id,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      email: inviteeEmail,
      accessRoleId: ROLES.MEMBER.id,
    });
  });

  it('should return correct accessRoleId for different roles', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    // Create invites with different roles
    const memberEmail = `member-invite-${task.id}@oneproject.org`;
    const adminEmail = `admin-invite-${task.id}@oneproject.org`;
    testData.trackProfileInvite(memberEmail, profile.id);
    testData.trackProfileInvite(adminEmail, profile.id);

    await db.insert(profileInvites).values([
      {
        email: memberEmail,
        profileId: profile.id,
        profileEntityType: EntityType.ORG,
        accessRoleId: ROLES.MEMBER.id,
        invitedBy: adminUser.userProfileId,
      },
      {
        email: adminEmail,
        profileId: profile.id,
        profileEntityType: EntityType.ORG,
        accessRoleId: ROLES.ADMIN.id,
        invitedBy: adminUser.userProfileId,
      },
    ]);

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.listProfileInvites({
      profileId: profile.id,
    });

    expect(result).toHaveLength(2);

    const memberInvite = result.find((r) => r.email === memberEmail);
    const adminInvite = result.find((r) => r.email === adminEmail);

    expect(memberInvite?.accessRoleId).toBe(ROLES.MEMBER.id);
    expect(adminInvite?.accessRoleId).toBe(ROLES.ADMIN.id);
  });

  it('should only return pending invites (not accepted ones)', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    const pendingEmail = `pending-${task.id}@oneproject.org`;
    const acceptedEmail = `accepted-${task.id}@oneproject.org`;
    testData.trackProfileInvite(pendingEmail, profile.id);
    testData.trackProfileInvite(acceptedEmail, profile.id);

    await db.insert(profileInvites).values([
      {
        email: pendingEmail,
        profileId: profile.id,
        profileEntityType: EntityType.ORG,
        accessRoleId: ROLES.MEMBER.id,
        invitedBy: adminUser.userProfileId,
      },
      {
        email: acceptedEmail,
        profileId: profile.id,
        profileEntityType: EntityType.ORG,
        accessRoleId: ROLES.MEMBER.id,
        invitedBy: adminUser.userProfileId,
        acceptedOn: new Date().toISOString(),
      },
    ]);

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.listProfileInvites({
      profileId: profile.id,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.email).toBe(pendingEmail);
    expect(result[0]?.accessRoleId).toBe(ROLES.MEMBER.id);
  });

  it('should return empty array when no pending invites exist', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.listProfileInvites({
      profileId: profile.id,
    });

    expect(result).toHaveLength(0);
  });
});
