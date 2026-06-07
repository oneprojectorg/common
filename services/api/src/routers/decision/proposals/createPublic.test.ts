import {
  type DecisionRolePermissions,
  setPublicParticipation,
} from '@op/common';
import { GLOBAL_USER_PUBLIC } from '@op/core';
import { db } from '@op/db/client';
import {
  ProposalStatus,
  accessRoles,
  profileUserToAccessRoles,
  profileUsers,
} from '@op/db/schema';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  createAuthenticatedCaller,
  createIsolatedTestClient,
  createTestContextWithSession,
  createTestUser,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

async function createAnonymousCaller(testData: TestDecisionsDataManager) {
  const client = createIsolatedTestClient();
  const { data, error } = await client.auth.signInAnonymously();

  if (error || !data.session || !data.user) {
    throw new Error(`Failed to create anonymous session: ${error?.message}`);
  }

  testData.trackAuthUserForCleanup(data.user.id);

  const userRecord = await db.query.users.findFirst({
    where: { authUserId: data.user.id },
  });

  if (userRecord?.profileId) {
    testData.trackProfileForCleanup(userRecord.profileId);
  }

  return {
    authUserId: data.user.id,
    caller: createCaller(await createTestContextWithSession(data.session)),
  };
}

/** Creates a confirmed, logged-in user who is NOT a member of any instance. */
async function createNonMemberCaller(testData: TestDecisionsDataManager) {
  const email = `nonmember-${randomUUID()}@oneproject.org`;
  const authUser = await createTestUser(email).then((res) => res.user);

  if (!authUser) {
    throw new Error(`Failed to create non-member user for ${email}`);
  }

  testData.trackAuthUserForCleanup(authUser.id);

  const userRecord = await db.query.users.findFirst({
    where: { authUserId: authUser.id },
  });

  if (userRecord?.profileId) {
    testData.trackProfileForCleanup(userRecord.profileId);
  }

  return {
    authUserId: authUser.id,
    caller: await createAuthenticatedCaller(email),
  };
}

const PUBLIC_SUBMIT_ONLY: DecisionRolePermissions = {
  create: false,
  read: true,
  update: false,
  delete: false,
  admin: false,
  inviteMembers: false,
  review: false,
  submitProposals: true,
  vote: false,
};

/**
 * Opens an instance profile to public proposal submission as its admin would:
 * writes the per-profile override row on the global Public role and grants it
 * to the GLOBAL_USER_PUBLIC sentinel. The public-join path can only succeed
 * once this configuration exists.
 */
async function enablePublicParticipation({
  profileId,
  adminEmail,
}: {
  profileId: string;
  adminEmail: string;
}) {
  const admin = await db.query.users.findFirst({
    where: { email: adminEmail },
  });

  if (!admin?.authUserId) {
    throw new Error(`Failed to resolve admin user for ${adminEmail}`);
  }

  await setPublicParticipation({
    profileId,
    permissions: PUBLIC_SUBMIT_ONLY,
    user: { id: admin.authUserId },
  });
}

async function getInstanceRoleNames({
  profileId,
  authUserId,
}: {
  profileId: string;
  authUserId: string;
}) {
  const rows = await db
    .select({ roleName: accessRoles.name })
    .from(profileUsers)
    .innerJoin(
      profileUserToAccessRoles,
      eq(profileUsers.id, profileUserToAccessRoles.profileUserId),
    )
    .innerJoin(
      accessRoles,
      eq(profileUserToAccessRoles.accessRoleId, accessRoles.id),
    )
    .where(
      and(
        eq(profileUsers.profileId, profileId),
        eq(profileUsers.authUserId, authUserId),
      ),
    );

  return rows.map((row) => row.roleName);
}

describe.concurrent('createPublicProposal', () => {
  it('joins an anonymous non-member with the global Public role and creates a draft proposal', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 1 });
    const instance = setup.instances[0];

    if (!instance) {
      throw new Error('No instance created');
    }

    await enablePublicParticipation({
      profileId: instance.profileId,
      adminEmail: setup.userEmail,
    });

    // Enabling grants the Public role to the public sentinel on this profile.
    expect(
      await getInstanceRoleNames({
        profileId: instance.profileId,
        authUserId: GLOBAL_USER_PUBLIC,
      }),
    ).toEqual(['Public']);

    const { authUserId, caller } = await createAnonymousCaller(testData);

    const proposal = await caller.decision.createPublicProposal({
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Anonymous public proposal' },
    });

    expect(proposal.status).toBe(ProposalStatus.DRAFT);
    if (proposal.profileId) {
      testData.trackProfileForCleanup(proposal.profileId);
    }

    expect(
      await getInstanceRoleNames({ profileId: instance.profileId, authUserId }),
    ).toEqual(['Public']);
  });

  it('rejects a non-member when the instance is not open to public participation', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 1 });
    const instance = setup.instances[0];

    if (!instance) {
      throw new Error('No instance created');
    }

    // No enablePublicParticipation — the instance has no public grant.
    const { authUserId, caller } = await createAnonymousCaller(testData);

    await expect(
      caller.decision.createPublicProposal({
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Should not be created' },
      }),
    ).rejects.toThrow("You don't have access to do this");

    // No membership was materialized for the rejected caller.
    expect(
      await getInstanceRoleNames({ profileId: instance.profileId, authUserId }),
    ).toEqual([]);
  });

  it('joins a logged-in non-member with the global Public role and creates a draft proposal', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 1 });
    const instance = setup.instances[0];

    if (!instance) {
      throw new Error('No instance created');
    }

    await enablePublicParticipation({
      profileId: instance.profileId,
      adminEmail: setup.userEmail,
    });
    const { authUserId, caller } = await createNonMemberCaller(testData);

    const proposal = await caller.decision.createPublicProposal({
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Logged-in non-member public proposal' },
    });

    expect(proposal.status).toBe(ProposalStatus.DRAFT);
    if (proposal.profileId) {
      testData.trackProfileForCleanup(proposal.profileId);
    }

    expect(
      await getInstanceRoleNames({ profileId: instance.profileId, authUserId }),
    ).toEqual(['Public']);
  });

  it('does not escalate an existing member who already has another role', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 1 });
    const instance = setup.instances[0];

    if (!instance) {
      throw new Error('No instance created');
    }

    // The setup creator is already an Admin member of the instance profile.
    const caller = await createAuthenticatedCaller(setup.userEmail);
    const creator = await db.query.users.findFirst({
      where: { email: setup.userEmail },
    });

    if (!creator?.authUserId) {
      throw new Error('Failed to resolve setup creator');
    }

    const rolesBefore = await getInstanceRoleNames({
      profileId: instance.profileId,
      authUserId: creator.authUserId,
    });
    expect(rolesBefore).toEqual(['Admin']);

    const proposal = await caller.decision.createPublicProposal({
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Existing member public proposal' },
    });

    expect(proposal.status).toBe(ProposalStatus.DRAFT);
    if (proposal.profileId) {
      testData.trackProfileForCleanup(proposal.profileId);
    }

    // Membership untouched — no extra Participant role granted.
    expect(
      await getInstanceRoleNames({
        profileId: instance.profileId,
        authUserId: creator.authUserId,
      }),
    ).toEqual(['Admin']);
  });

  it('is idempotent across repeated calls — one membership, no duplicate roles', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 1 });
    const instance = setup.instances[0];

    if (!instance) {
      throw new Error('No instance created');
    }

    await enablePublicParticipation({
      profileId: instance.profileId,
      adminEmail: setup.userEmail,
    });
    const { authUserId, caller } = await createAnonymousCaller(testData);
    const input = {
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Idempotent public proposal' },
    } as const;

    const first = await caller.decision.createPublicProposal(input);
    const second = await caller.decision.createPublicProposal(input);

    for (const proposal of [first, second]) {
      if (proposal.profileId) {
        testData.trackProfileForCleanup(proposal.profileId);
      }
    }

    // Two proposals were created, but the membership was granted exactly once.
    expect(
      await getInstanceRoleNames({ profileId: instance.profileId, authUserId }),
    ).toEqual(['Public']);
  });
});
