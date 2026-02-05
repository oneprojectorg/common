import { db, eq } from '@op/db/client';
import { profileInvites } from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { describe, expect, it, vi } from 'vitest';

import { TestProfileUserDataManager } from '../../test/helpers/TestProfileUserDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';
import { deleteInvitationRouter } from './deleteInvitation';
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

describe.concurrent('profile.deleteInvitation', () => {
  const createDeleteCaller = createCallerFactory(deleteInvitationRouter);
  const createInviteCaller = createCallerFactory(inviteProfileUserRouter);

  it('should delete a pending invite', async ({ task, onTestFinished }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    // Create a standalone user to be invited
    const standaloneUser = await testData.createStandaloneUser();
    testData.trackProfileInvite(standaloneUser.email, profile.id);

    const { session } = await createIsolatedSession(adminUser.email);

    // First, create an invite
    const inviteCaller = createInviteCaller(
      await createTestContextWithSession(session),
    );
    await inviteCaller.invite({
      invitations: [{ email: standaloneUser.email, roleId: ROLES.MEMBER.id }],
      profileId: profile.id,
    });

    // Get the invite ID
    const invite = await db._query.profileInvites.findFirst({
      where: (table, { eq, and }) =>
        and(
          eq(table.profileId, profile.id),
          eq(table.email, standaloneUser.email.toLowerCase()),
        ),
    });

    expect(invite).toBeDefined();

    // Now delete the invite
    const deleteCaller = createDeleteCaller(
      await createTestContextWithSession(session),
    );
    const result = await deleteCaller.deleteInvitation({
      inviteId: invite!.id,
      profileId: profile.id,
    });

    expect(result.success).toBe(true);
    expect(result.email).toBe(standaloneUser.email.toLowerCase());

    // Verify invite was deleted
    const deletedInvite = await db._query.profileInvites.findFirst({
      where: (table, { eq }) => eq(table.id, invite!.id),
    });

    expect(deletedInvite).toBeUndefined();
  });

  it('should fail when invite does not exist', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createDeleteCaller(
      await createTestContextWithSession(session),
    );

    await expect(
      caller.deleteInvitation({
        inviteId: '00000000-0000-0000-0000-000000000000',
        profileId: profile.id,
      }),
    ).rejects.toThrow(/not found/i);
  });

  it('should fail when invite belongs to a different profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);

    // Create two profiles
    const { profile: profile1, adminUser: admin1 } =
      await testData.createProfile({
        users: { admin: 1 },
      });

    const { profile: profile2 } = await testData.createProfile({
      users: { admin: 1 },
    });

    // Create an invite in profile2
    const standaloneUser = await testData.createStandaloneUser();
    testData.trackProfileInvite(standaloneUser.email, profile2.id);

    const { session: session2 } = await createIsolatedSession(
      // Need to use the admin of profile2 to create the invite
      (await db._query.profileUsers.findFirst({
        where: (table, { eq }) => eq(table.profileId, profile2.id),
      }))!.email,
    );

    const inviteCaller = createInviteCaller(
      await createTestContextWithSession(session2),
    );
    await inviteCaller.invite({
      invitations: [{ email: standaloneUser.email, roleId: ROLES.MEMBER.id }],
      profileId: profile2.id,
    });

    // Get the invite ID from profile2
    const invite = await db._query.profileInvites.findFirst({
      where: (table, { eq, and }) =>
        and(
          eq(table.profileId, profile2.id),
          eq(table.email, standaloneUser.email.toLowerCase()),
        ),
    });

    expect(invite).toBeDefined();

    // Try to delete using admin1's session but with profile1's ID
    const { session: session1 } = await createIsolatedSession(admin1.email);
    const deleteCaller = createDeleteCaller(
      await createTestContextWithSession(session1),
    );

    // Implementation throws "not found" to avoid leaking info about invites in other profiles
    await expect(
      deleteCaller.deleteInvitation({
        inviteId: invite!.id,
        profileId: profile1.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });

  it('should fail when invite is already accepted', async ({
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

    // Create an invite
    const inviteCaller = createInviteCaller(
      await createTestContextWithSession(session),
    );
    await inviteCaller.invite({
      invitations: [{ email: standaloneUser.email, roleId: ROLES.MEMBER.id }],
      profileId: profile.id,
    });

    // Get the invite and manually mark it as accepted
    const invite = await db._query.profileInvites.findFirst({
      where: (table, { eq, and }) =>
        and(
          eq(table.profileId, profile.id),
          eq(table.email, standaloneUser.email.toLowerCase()),
        ),
    });

    expect(invite).toBeDefined();

    // Mark as accepted by setting acceptedOn
    await db
      .update(profileInvites)
      .set({ acceptedOn: new Date().toISOString() })
      .where(eq(profileInvites.id, invite!.id));

    // Try to delete the accepted invite
    const deleteCaller = createDeleteCaller(
      await createTestContextWithSession(session),
    );

    await expect(
      deleteCaller.deleteInvitation({
        inviteId: invite!.id,
        profileId: profile.id,
      }),
    ).rejects.toThrow(/only pending invites can be revoked/i);
  });

  it('should fail when non-admin tries to delete an invite', async ({
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

    // Admin creates the invite
    const { session: adminSession } = await createIsolatedSession(
      adminUser.email,
    );
    const inviteCaller = createInviteCaller(
      await createTestContextWithSession(adminSession),
    );
    await inviteCaller.invite({
      invitations: [{ email: standaloneUser.email, roleId: ROLES.MEMBER.id }],
      profileId: profile.id,
    });

    // Get the invite ID
    const invite = await db._query.profileInvites.findFirst({
      where: (table, { eq, and }) =>
        and(
          eq(table.profileId, profile.id),
          eq(table.email, standaloneUser.email.toLowerCase()),
        ),
    });

    expect(invite).toBeDefined();

    // Member tries to delete the invite
    const { session: memberSession } = await createIsolatedSession(
      memberUser.email,
    );
    const deleteCaller = createDeleteCaller(
      await createTestContextWithSession(memberSession),
    );

    await expect(
      deleteCaller.deleteInvitation({
        inviteId: invite!.id,
        profileId: profile.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });
});
