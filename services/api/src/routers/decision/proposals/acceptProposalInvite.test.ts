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

describe.concurrent('decision.acceptProposalInvite', () => {
  it('should add user as Member of the decision process when accepting a proposal invite', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const profileData = new TestProfileUserDataManager(task.id, onTestFinished);

    // Create a decision setup with one instance and access
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    // Create a proposal
    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Test Proposal' },
    });

    // Create a standalone invitee user
    const invitee = await profileData.createStandaloneUser();

    // Insert a pending invite for the invitee on the proposal's profile
    const [invite] = await db
      .insert(profileInvites)
      .values({
        email: invitee.email,
        profileId: proposal.profileId,
        profileEntityType: EntityType.PROPOSAL,
        accessRoleId: ROLES.MEMBER.id,
        invitedBy: setup.organization.profileId,
      })
      .returning();

    if (!invite) {
      throw new Error('Failed to create invite');
    }

    profileData.trackProfileInvite(invitee.email, proposal.profileId);

    // Accept the proposal invite
    const caller = await createAuthenticatedCaller(invitee.email);
    const result = await caller.decision.acceptProposalInvite({
      inviteId: invite.id,
    });

    // Assert: user is a profileUser of the proposal profile
    expect(result).toBeDefined();
    expect(result.profileId).toBe(proposal.profileId);
    expect(result.authUserId).toBe(invitee.authUserId);

    // Assert: user is a profileUser of the decision process profile with Member role
    const decisionProfileUser = await db.query.profileUsers.findFirst({
      where: {
        profileId: instance.profileId,
        authUserId: invitee.authUserId,
      },
      with: {
        roles: {
          with: {
            accessRole: true,
          },
        },
      },
    });

    expect(decisionProfileUser).toBeDefined();
    expect(decisionProfileUser?.roles).toHaveLength(1);
    expect(decisionProfileUser?.roles[0]?.accessRole.id).toBe(ROLES.MEMBER.id);
  });

  it('should skip decision membership if user is already a member', async ({
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

    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Test Proposal' },
    });

    // Create invitee and grant them access to the decision process first
    const invitee = await profileData.createStandaloneUser();
    await testData.grantProfileAccess(
      instance.profileId,
      invitee.authUserId,
      invitee.email,
      false, // Member role
    );

    // Insert a pending invite for the invitee on the proposal's profile
    const [invite] = await db
      .insert(profileInvites)
      .values({
        email: invitee.email,
        profileId: proposal.profileId,
        profileEntityType: EntityType.PROPOSAL,
        accessRoleId: ROLES.MEMBER.id,
        invitedBy: setup.organization.profileId,
      })
      .returning();

    if (!invite) {
      throw new Error('Failed to create invite');
    }

    profileData.trackProfileInvite(invitee.email, proposal.profileId);

    // Accept the proposal invite
    const caller = await createAuthenticatedCaller(invitee.email);
    await caller.decision.acceptProposalInvite({
      inviteId: invite.id,
    });

    // Assert: no duplicate profileUser entries for the decision process
    const decisionProfileUsers = await db.query.profileUsers.findMany({
      where: {
        profileId: instance.profileId,
        authUserId: invitee.authUserId,
      },
    });

    expect(decisionProfileUsers).toHaveLength(1);
  });

  it('should accept an existing pending decision invite instead of creating a new membership', async ({
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

    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Test Proposal' },
    });

    // Create invitee
    const invitee = await profileData.createStandaloneUser();

    // Insert a pending invite for the decision process profile
    const [decisionInvite] = await db
      .insert(profileInvites)
      .values({
        email: invitee.email,
        profileId: instance.profileId,
        profileEntityType: EntityType.DECISION,
        accessRoleId: ROLES.MEMBER.id,
        invitedBy: setup.organization.profileId,
      })
      .returning();

    if (!decisionInvite) {
      throw new Error('Failed to create decision invite');
    }

    profileData.trackProfileInvite(invitee.email, instance.profileId);

    // Insert a pending invite for the proposal profile
    const [proposalInvite] = await db
      .insert(profileInvites)
      .values({
        email: invitee.email,
        profileId: proposal.profileId,
        profileEntityType: EntityType.PROPOSAL,
        accessRoleId: ROLES.MEMBER.id,
        invitedBy: setup.organization.profileId,
      })
      .returning();

    if (!proposalInvite) {
      throw new Error('Failed to create proposal invite');
    }

    profileData.trackProfileInvite(invitee.email, proposal.profileId);

    // Accept the proposal invite
    const caller = await createAuthenticatedCaller(invitee.email);
    await caller.decision.acceptProposalInvite({
      inviteId: proposalInvite.id,
    });

    // Assert: the decision process invite is now accepted
    const updatedDecisionInvite = await db.query.profileInvites.findFirst({
      where: { id: decisionInvite.id },
    });

    expect(updatedDecisionInvite?.acceptedOn).not.toBeNull();

    // Assert: user is a profileUser of the decision process
    const decisionProfileUser = await db.query.profileUsers.findFirst({
      where: {
        profileId: instance.profileId,
        authUserId: invitee.authUserId,
      },
    });

    expect(decisionProfileUser).toBeDefined();
  });
});
