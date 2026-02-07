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
import accountRouter from './index';

describe.concurrent('account.listMyInvites', () => {
  const createCaller = createCallerFactory(accountRouter);

  it('should return pending invites for the authenticated user', async ({
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
        profileEntityType: EntityType.DECISION,
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

    const result = await caller.listMyInvites({ pending: true });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(invite.id);
    expect(result[0]?.email).toBe(invitee.email);
  });

  it('should return empty array when user has no invites', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);

    const user = await testData.createStandaloneUser();

    const { session } = await createIsolatedSession(user.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.listMyInvites({ pending: true });

    expect(result).toHaveLength(0);
  });

  it('should filter by entityType', async ({ task, onTestFinished }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);

    const { profile: decisionProfile, adminUser: decisionAdmin } =
      await testData.createProfile({
        users: { admin: 1 },
        profileName: 'Decision Profile',
      });

    const { profile: orgProfile, adminUser: orgAdmin } =
      await testData.createProfile({
        users: { admin: 1 },
        profileName: 'Org Profile',
      });

    const invitee = await testData.createStandaloneUser();

    // Create a DECISION invite
    await db.insert(profileInvites).values({
      email: invitee.email,
      profileId: decisionProfile.id,
      profileEntityType: EntityType.DECISION,
      accessRoleId: ROLES.MEMBER.id,
      invitedBy: decisionAdmin.userProfileId,
    });

    testData.trackProfileInvite(invitee.email, decisionProfile.id);

    // Create an ORG invite
    await db.insert(profileInvites).values({
      email: invitee.email,
      profileId: orgProfile.id,
      profileEntityType: EntityType.ORG,
      accessRoleId: ROLES.MEMBER.id,
      invitedBy: orgAdmin.userProfileId,
    });

    testData.trackProfileInvite(invitee.email, orgProfile.id);

    const { session } = await createIsolatedSession(invitee.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Filter for DECISION only
    const decisionInvites = await caller.listMyInvites({
      entityType: EntityType.DECISION,
      pending: true,
    });

    expect(decisionInvites).toHaveLength(1);
    expect(decisionInvites[0]?.profileId).toBe(decisionProfile.id);

    // Filter for ORG only
    const orgInvites = await caller.listMyInvites({
      entityType: EntityType.ORG,
      pending: true,
    });

    expect(orgInvites).toHaveLength(1);
    expect(orgInvites[0]?.profileId).toBe(orgProfile.id);

    // No filter returns both
    const allInvites = await caller.listMyInvites({ pending: true });

    expect(allInvites).toHaveLength(2);
  });

  it('should filter by pending status', async ({ task, onTestFinished }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);

    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    const { profile: profile2, adminUser: admin2 } =
      await testData.createProfile({
        users: { admin: 1 },
        profileName: 'Second Profile',
      });

    const invitee = await testData.createStandaloneUser();

    // Create a pending invite
    await db.insert(profileInvites).values({
      email: invitee.email,
      profileId: profile.id,
      profileEntityType: EntityType.ORG,
      accessRoleId: ROLES.MEMBER.id,
      invitedBy: adminUser.userProfileId,
    });

    testData.trackProfileInvite(invitee.email, profile.id);

    // Create an accepted invite
    await db.insert(profileInvites).values({
      email: invitee.email,
      profileId: profile2.id,
      profileEntityType: EntityType.ORG,
      accessRoleId: ROLES.MEMBER.id,
      invitedBy: admin2.userProfileId,
      acceptedOn: new Date().toISOString(),
    });

    testData.trackProfileInvite(invitee.email, profile2.id);

    const { session } = await createIsolatedSession(invitee.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // pending: true returns only the pending invite
    const pendingInvites = await caller.listMyInvites({ pending: true });

    expect(pendingInvites).toHaveLength(1);
    expect(pendingInvites[0]?.profileId).toBe(profile.id);

    // pending: false returns only the accepted invite
    const acceptedInvites = await caller.listMyInvites({ pending: false });

    expect(acceptedInvites).toHaveLength(1);
    expect(acceptedInvites[0]?.profileId).toBe(profile2.id);

    // No pending filter returns both
    const allInvites = await caller.listMyInvites({});

    expect(allInvites).toHaveLength(2);
  });

  it('should match emails case-insensitively', async ({
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
    await db.insert(profileInvites).values({
      email: uppercaseEmail,
      profileId: profile.id,
      profileEntityType: EntityType.ORG,
      accessRoleId: ROLES.MEMBER.id,
      invitedBy: adminUser.userProfileId,
    });

    testData.trackProfileInvite(uppercaseEmail, profile.id);

    const { session } = await createIsolatedSession(invitee.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.listMyInvites({ pending: true });

    expect(result).toHaveLength(1);
  });

  it('should include related profile and inviter data', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);

    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    const invitee = await testData.createStandaloneUser();

    await db.insert(profileInvites).values({
      email: invitee.email,
      profileId: profile.id,
      profileEntityType: EntityType.DECISION,
      accessRoleId: ROLES.MEMBER.id,
      invitedBy: adminUser.userProfileId,
    });

    testData.trackProfileInvite(invitee.email, profile.id);

    const { session } = await createIsolatedSession(invitee.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.listMyInvites({
      entityType: EntityType.DECISION,
      pending: true,
    });

    expect(result).toHaveLength(1);

    const invite = result[0]!;
    // db._query returns relations as array | object, normalize for assertions
    const inviteProfile = Array.isArray(invite.profile)
      ? invite.profile[0]
      : invite.profile;
    const inviteRole = Array.isArray(invite.accessRole)
      ? invite.accessRole[0]
      : invite.accessRole;
    const inviteInviter = Array.isArray(invite.inviter)
      ? invite.inviter[0]
      : invite.inviter;

    // Verify profile relation is populated
    expect(inviteProfile).toBeDefined();
    expect(inviteProfile?.id).toBe(profile.id);

    // Verify accessRole relation is populated
    expect(inviteRole).toBeDefined();
    expect(inviteRole?.id).toBe(ROLES.MEMBER.id);

    // Verify inviter relation is populated with the correct inviter
    expect(inviteInviter).toBeDefined();
    expect(inviteInviter?.id).toBe(adminUser.userProfileId);
  });

  it('should not return invites for other users', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);

    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    const invitee = await testData.createStandaloneUser();
    const otherUser = await testData.createStandaloneUser();

    // Create invite for invitee
    await db.insert(profileInvites).values({
      email: invitee.email,
      profileId: profile.id,
      profileEntityType: EntityType.ORG,
      accessRoleId: ROLES.MEMBER.id,
      invitedBy: adminUser.userProfileId,
    });

    testData.trackProfileInvite(invitee.email, profile.id);

    // Query as otherUser — should not see invitee's invite
    const { session } = await createIsolatedSession(otherUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.listMyInvites({ pending: true });

    expect(result).toHaveLength(0);
  });
});
