import { db } from '@op/db/client';
import { EntityType, profileInvites } from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import { TestProfileUserDataManager } from '../../../test/helpers/TestProfileUserDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

describe.concurrent('decision.acceptDecisionInvite', () => {
  it('should add user as member of the decision process when accepting a decision invite', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const profileData = new TestProfileUserDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const invitee = await profileData.createStandaloneUser();

    const [invite] = await db
      .insert(profileInvites)
      .values({
        email: invitee.email,
        profileId: instance.profileId,
        profileEntityType: EntityType.DECISION,
        accessRoleId: ROLES.MEMBER.id,
        invitedBy: setup.organization.profileId,
      })
      .returning();

    if (!invite) {
      throw new Error('Failed to create invite');
    }

    profileData.trackProfileInvite(invitee.email, instance.profileId);

    const caller = await createAuthenticatedCaller(invitee.email);
    await caller.decision.acceptDecisionInvite({
      profileId: instance.profileId,
    });

    const decisionProfileUser = await db.query.profileUsers.findFirst({
      where: {
        profileId: instance.profileId,
        authUserId: invitee.authUserId,
      },
      with: {
        roles: {
          with: { accessRole: true },
        },
      },
    });

    expect(decisionProfileUser).toBeDefined();
    expect(decisionProfileUser?.roles).toHaveLength(1);
    expect(decisionProfileUser?.roles[0]?.accessRole.id).toBe(ROLES.MEMBER.id);

    const updatedInvite = await db.query.profileInvites.findFirst({
      where: { id: invite.id },
    });
    expect(updatedInvite?.acceptedOn).not.toBeNull();
  });

  it('should fail when invite does not exist', async ({
    task,
    onTestFinished,
  }) => {
    const profileData = new TestProfileUserDataManager(task.id, onTestFinished);
    const invitee = await profileData.createStandaloneUser();

    const caller = await createAuthenticatedCaller(invitee.email);

    await expect(
      caller.decision.acceptDecisionInvite({
        profileId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'NotFoundError' },
    });
  });

  it('should fail when invite is already accepted', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const profileData = new TestProfileUserDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const invitee = await profileData.createStandaloneUser();

    const [invite] = await db
      .insert(profileInvites)
      .values({
        email: invitee.email,
        profileId: instance.profileId,
        profileEntityType: EntityType.DECISION,
        accessRoleId: ROLES.MEMBER.id,
        invitedBy: setup.organization.profileId,
        acceptedOn: new Date().toISOString(),
      })
      .returning();

    if (!invite) {
      throw new Error('Failed to create invite');
    }

    profileData.trackProfileInvite(invitee.email, instance.profileId);

    const caller = await createAuthenticatedCaller(invitee.email);

    await expect(
      caller.decision.acceptDecisionInvite({
        profileId: instance.profileId,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'NotFoundError' },
    });
  });

  it('should fail when user is already a member of the decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const profileData = new TestProfileUserDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const invitee = await profileData.createStandaloneUser();
    await testData.grantProfileAccess(
      instance.profileId,
      invitee.authUserId,
      invitee.email,
      false,
    );

    const [invite] = await db
      .insert(profileInvites)
      .values({
        email: invitee.email,
        profileId: instance.profileId,
        profileEntityType: EntityType.DECISION,
        accessRoleId: ROLES.MEMBER.id,
        invitedBy: setup.organization.profileId,
      })
      .returning();

    if (!invite) {
      throw new Error('Failed to create invite');
    }

    profileData.trackProfileInvite(invitee.email, instance.profileId);

    const caller = await createAuthenticatedCaller(invitee.email);

    await expect(
      caller.decision.acceptDecisionInvite({
        profileId: instance.profileId,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'CommonError' },
    });
  });
});
