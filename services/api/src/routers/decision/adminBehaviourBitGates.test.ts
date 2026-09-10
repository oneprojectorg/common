import { db, eq } from '@op/db/client';
import { ProposalStatus, processInstances, proposals } from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import {
  TEST_PERMISSION_BITS,
  grantInstanceAdminOnlyRole,
  grantInstanceRole,
  testSimpleVotingSchema,
} from '@op/test';
import { describe, expect, it } from 'vitest';

import { appRouter } from '..';
import { TestDecisionsDataManager } from '../../test/helpers/TestDecisionsDataManager';
import { TestReviewsDataManager } from '../../test/helpers/TestReviewsDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

interface Actor {
  email: string;
  authUserId: string;
  profileId: string;
}

interface ActorOptions {
  testData: TestDecisionsDataManager;
  organization: { id: string };
  instanceProfileId: string;
}

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

/** Holds `decisions` ADMIN and no behaviour bit — never `profile` ADMIN. */
async function createAdminOnlyActor({
  testData,
  organization,
  instanceProfileId,
}: ActorOptions): Promise<Actor> {
  const actor = await testData.createMemberUser({ organization });

  await grantInstanceAdminOnlyRole({
    instanceProfileId,
    authUserId: actor.authUserId,
    email: actor.email,
  });

  return actor;
}

/** Holds READ plus one behaviour bit, and no ADMIN of either spelling. */
async function createBitHolderActor({
  testData,
  organization,
  instanceProfileId,
  behaviourBit,
  roleName,
}: ActorOptions & { behaviourBit: number; roleName: string }): Promise<Actor> {
  const actor = await testData.createMemberUser({ organization });

  await grantInstanceRole({
    instanceProfileId,
    authUserId: actor.authUserId,
    email: actor.email,
    roleName,
    decisionsPermission: TEST_PERMISSION_BITS.READ | behaviourBit,
  });

  return actor;
}

/** Holds READ alone, so no action gate admits them. */
async function createReadOnlyActor({
  testData,
  organization,
  instanceProfileId,
}: ActorOptions): Promise<Actor> {
  const actor = await testData.createMemberUser({ organization });

  await grantInstanceRole({
    instanceProfileId,
    authUserId: actor.authUserId,
    email: actor.email,
    roleName: 'Observer',
    decisionsPermission: TEST_PERMISSION_BITS.READ,
  });

  return actor;
}

function buildVotingSchema() {
  return {
    id: 'admin-gate-voting',
    version: '1.0.0',
    name: 'Admin Gate Voting Schema',
    description: 'Schema for the admin VOTE gate test',
    phases: [
      {
        id: 'submission',
        name: 'Submission',
        rules: {
          proposals: { submit: true },
          voting: { submit: false },
          advancement: { method: 'manual' as const },
        },
      },
      {
        id: 'voting',
        name: 'Voting',
        rules: {
          proposals: { submit: false },
          voting: { submit: true },
          advancement: { method: 'manual' as const },
        },
      },
    ],
  };
}

describe.concurrent('createProposal SUBMIT_PROPOSALS gate', () => {
  it('admits a decisions-ADMIN admin and a SUBMIT_PROPOSALS member, and rejects a READ-only member', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;
    const actorOptions = {
      testData,
      organization: setup.organization,
      instanceProfileId: instance.profileId,
    };

    const admin = await createAdminOnlyActor(actorOptions);
    const bitHolder = await createBitHolderActor({
      ...actorOptions,
      behaviourBit: TEST_PERMISSION_BITS.SUBMIT_PROPOSALS,
      roleName: 'Submitter',
    });
    const readOnly = await createReadOnlyActor(actorOptions);

    const [adminCaller, bitHolderCaller, readOnlyCaller] = await Promise.all([
      createAuthenticatedCaller(admin.email),
      createAuthenticatedCaller(bitHolder.email),
      createAuthenticatedCaller(readOnly.email),
    ]);

    const adminProposal = await adminCaller.decision.createProposal({
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Draft by the admin' },
    });
    testData.trackProfileForCleanup(adminProposal.profileId);
    expect(adminProposal.status).toBe(ProposalStatus.DRAFT);

    const bitHolderProposal = await bitHolderCaller.decision.createProposal({
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Draft by the bit holder' },
    });
    testData.trackProfileForCleanup(bitHolderProposal.profileId);
    expect(bitHolderProposal.status).toBe(ProposalStatus.DRAFT);

    await expect(
      readOnlyCaller.decision.createProposal({
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Draft by the read-only member' },
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});

describe.concurrent('submitProposal SUBMIT_PROPOSALS gate', () => {
  it('admits a decisions-ADMIN admin and a SUBMIT_PROPOSALS member, and rejects a READ-only member', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;
    const actorOptions = {
      testData,
      organization: setup.organization,
      instanceProfileId: instance.profileId,
    };

    const admin = await createAdminOnlyActor(actorOptions);
    const bitHolder = await createBitHolderActor({
      ...actorOptions,
      behaviourBit: TEST_PERMISSION_BITS.SUBMIT_PROPOSALS,
      roleName: 'Submitter',
    });
    const readOnly = await createReadOnlyActor(actorOptions);

    const drafts = await Promise.all(
      ['admin', 'bit holder', 'read-only member'].map((label) =>
        testData.createProposal({
          userEmail: setup.userEmail,
          processInstanceId: instance.instance.id,
          proposalData: { title: `Draft submitted by the ${label}` },
        }),
      ),
    );

    const [adminCaller, bitHolderCaller, readOnlyCaller] = await Promise.all([
      createAuthenticatedCaller(admin.email),
      createAuthenticatedCaller(bitHolder.email),
      createAuthenticatedCaller(readOnly.email),
    ]);

    const adminResult = await adminCaller.decision.submitProposal({
      proposalId: drafts[0]!.id,
    });
    expect(adminResult.status).toBe(ProposalStatus.SUBMITTED);

    const bitHolderResult = await bitHolderCaller.decision.submitProposal({
      proposalId: drafts[1]!.id,
    });
    expect(bitHolderResult.status).toBe(ProposalStatus.SUBMITTED);

    await expect(
      readOnlyCaller.decision.submitProposal({ proposalId: drafts[2]!.id }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});

describe.concurrent('proposal comment SUBMIT_PROPOSALS gate', () => {
  it('admits a decisions-ADMIN admin and a SUBMIT_PROPOSALS member, and rejects a READ-only member', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Commentable proposal', description: 'desc' },
    });
    const actorOptions = {
      testData,
      organization: setup.organization,
      instanceProfileId: instance.profileId,
    };

    const admin = await createAdminOnlyActor(actorOptions);
    const bitHolder = await createBitHolderActor({
      ...actorOptions,
      behaviourBit: TEST_PERMISSION_BITS.SUBMIT_PROPOSALS,
      roleName: 'Submitter',
    });
    const readOnly = await createReadOnlyActor(actorOptions);

    const [adminCaller, bitHolderCaller, readOnlyCaller] = await Promise.all([
      createAuthenticatedCaller(admin.email),
      createAuthenticatedCaller(bitHolder.email),
      createAuthenticatedCaller(readOnly.email),
    ]);

    const adminComment = await adminCaller.posts.createPost({
      content: 'Comment by the admin.',
      profileId: proposal.profileId,
    });
    expect(adminComment.content).toBe('Comment by the admin.');

    const bitHolderComment = await bitHolderCaller.posts.createPost({
      content: 'Comment by the bit holder.',
      profileId: proposal.profileId,
    });
    expect(bitHolderComment.content).toBe('Comment by the bit holder.');

    await expect(
      readOnlyCaller.posts.createPost({
        content: 'Comment by the read-only member.',
        profileId: proposal.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });
});

describe.concurrent('toggleLike SUBMIT_PROPOSALS gate', () => {
  it('admits a decisions-ADMIN admin and a SUBMIT_PROPOSALS member, and rejects a READ-only member', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Likeable proposal', description: 'desc' },
    });
    const actorOptions = {
      testData,
      organization: setup.organization,
      instanceProfileId: instance.profileId,
    };

    const ownerCaller = await createAuthenticatedCaller(setup.userEmail);
    const post = await ownerCaller.posts.createPost({
      content: 'Update on the proposal.',
      profileId: proposal.profileId,
    });

    const admin = await createAdminOnlyActor(actorOptions);
    const bitHolder = await createBitHolderActor({
      ...actorOptions,
      behaviourBit: TEST_PERMISSION_BITS.SUBMIT_PROPOSALS,
      roleName: 'Submitter',
    });
    const readOnly = await createReadOnlyActor(actorOptions);

    const [adminCaller, bitHolderCaller, readOnlyCaller] = await Promise.all([
      createAuthenticatedCaller(admin.email),
      createAuthenticatedCaller(bitHolder.email),
      createAuthenticatedCaller(readOnly.email),
    ]);

    const adminResult = await adminCaller.organization.toggleLike({
      postId: post.id,
    });
    expect(adminResult.action).toBe('added');

    const bitHolderResult = await bitHolderCaller.organization.toggleLike({
      postId: post.id,
    });
    expect(bitHolderResult.action).toBe('added');

    await expect(
      readOnlyCaller.organization.toggleLike({ postId: post.id }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });
});

describe.concurrent('invite INVITE_MEMBERS gate', () => {
  it('admits a decisions-ADMIN admin and an INVITE_MEMBERS member, and rejects a READ-only member', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;
    const actorOptions = {
      testData,
      organization: setup.organization,
      instanceProfileId: instance.profileId,
    };

    const admin = await createAdminOnlyActor(actorOptions);
    const bitHolder = await createBitHolderActor({
      ...actorOptions,
      behaviourBit: TEST_PERMISSION_BITS.INVITE_MEMBERS,
      roleName: 'Inviter',
    });
    const readOnly = await createReadOnlyActor(actorOptions);

    // Invitees already have accounts, so no allowList row outlives the test.
    const [inviteeA, inviteeB, inviteeC] = await Promise.all([
      testData.createMemberUser({ organization: setup.organization }),
      testData.createMemberUser({ organization: setup.organization }),
      testData.createMemberUser({ organization: setup.organization }),
    ]);

    const [adminCaller, bitHolderCaller, readOnlyCaller] = await Promise.all([
      createAuthenticatedCaller(admin.email),
      createAuthenticatedCaller(bitHolder.email),
      createAuthenticatedCaller(readOnly.email),
    ]);

    const adminResult = await adminCaller.profile.invite({
      invitations: [{ email: inviteeA.email, roleId: ROLES.MEMBER.id }],
      profileId: instance.profileId,
    });
    expect(adminResult.details.successful).toContain(
      inviteeA.email.toLowerCase(),
    );

    const bitHolderResult = await bitHolderCaller.profile.invite({
      invitations: [{ email: inviteeB.email, roleId: ROLES.MEMBER.id }],
      profileId: instance.profileId,
    });
    expect(bitHolderResult.details.successful).toContain(
      inviteeB.email.toLowerCase(),
    );

    await expect(
      readOnlyCaller.profile.invite({
        invitations: [{ email: inviteeC.email, roleId: ROLES.MEMBER.id }],
        profileId: instance.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});

describe.concurrent('submitVote VOTE gate', () => {
  it('admits a decisions-ADMIN admin and a VOTE member, and rejects a READ-only member', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      processSchema: buildVotingSchema(),
    });
    const instance = setup.instance;
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Votable proposal' },
      status: ProposalStatus.SUBMITTED,
    });

    await db
      .update(processInstances)
      .set({ currentStateId: 'voting' })
      .where(eq(processInstances.id, instance.instance.id));

    const actorOptions = {
      testData,
      organization: setup.organization,
      instanceProfileId: instance.profileId,
    };

    const admin = await createAdminOnlyActor(actorOptions);
    const bitHolder = await createBitHolderActor({
      ...actorOptions,
      behaviourBit: TEST_PERMISSION_BITS.VOTE,
      roleName: 'Voter',
    });
    const readOnly = await createReadOnlyActor(actorOptions);

    const [adminCaller, bitHolderCaller, readOnlyCaller] = await Promise.all([
      createAuthenticatedCaller(admin.email),
      createAuthenticatedCaller(bitHolder.email),
      createAuthenticatedCaller(readOnly.email),
    ]);

    const adminVote = await adminCaller.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: [proposal.id],
    });
    expect(adminVote.selectedProposalIds).toEqual([proposal.id]);

    const bitHolderVote = await bitHolderCaller.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: [proposal.id],
    });
    expect(bitHolderVote.selectedProposalIds).toEqual([proposal.id]);

    await expect(
      readOnlyCaller.decision.submitVote({
        processInstanceId: instance.instance.id,
        selectedProposalIds: [proposal.id],
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});

describe.concurrent('listReviewerCategories REVIEW gate', () => {
  it('admits a decisions-ADMIN admin and a REVIEW member, and rejects a READ-only member', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      processSchema: testSimpleVotingSchema,
    });
    const instance = setup.instance;
    const actorOptions = {
      testData,
      organization: setup.organization,
      instanceProfileId: instance.profileId,
    };

    const admin = await createAdminOnlyActor(actorOptions);
    const bitHolder = await createBitHolderActor({
      ...actorOptions,
      behaviourBit: TEST_PERMISSION_BITS.REVIEW,
      roleName: 'Reviewer',
    });
    const readOnly = await createReadOnlyActor(actorOptions);

    const [adminCaller, bitHolderCaller, readOnlyCaller] = await Promise.all([
      createAuthenticatedCaller(admin.email),
      createAuthenticatedCaller(bitHolder.email),
      createAuthenticatedCaller(readOnly.email),
    ]);

    const adminResult = await adminCaller.decision.listReviewerCategories({
      processInstanceId: instance.instance.id,
      phaseId: 'review',
    });
    expect(adminResult.items).toEqual([]);

    const bitHolderResult =
      await bitHolderCaller.decision.listReviewerCategories({
        processInstanceId: instance.instance.id,
        phaseId: 'review',
      });
    expect(bitHolderResult.items).toEqual([]);

    await expect(
      readOnlyCaller.decision.listReviewerCategories({
        processInstanceId: instance.instance.id,
        phaseId: 'review',
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});

describe.concurrent('frontend access mirrors', () => {
  it('reports all-true instance access for an admin holding only decisions ADMIN', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;

    const admin = await createAdminOnlyActor({
      testData,
      organization: setup.organization,
      instanceProfileId: instance.profileId,
    });
    const adminCaller = await createAuthenticatedCaller(admin.email);

    const result = await adminCaller.decision.getInstance({
      instanceId: instance.instance.id,
    });

    expect(result.access).toEqual({
      delete: true,
      update: true,
      read: true,
      create: true,
      admin: true,
      inviteMembers: true,
      review: true,
      submitProposals: true,
      vote: true,
    });
  });

  it('reports proposal access.submitProposals for an admin holding only decisions ADMIN', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Admin comment mirror', description: 'desc' },
    });
    await db
      .update(proposals)
      .set({ status: ProposalStatus.SUBMITTED })
      .where(eq(proposals.id, proposal.id));

    const admin = await createAdminOnlyActor({
      testData,
      organization: setup.organization,
      instanceProfileId: instance.profileId,
    });
    const adminCaller = await createAuthenticatedCaller(admin.email);

    const result = await adminCaller.decision.getProposal({
      profileId: proposal.profileId,
    });

    expect(result.access?.submitProposals).toBe(true);
  });
});

describe.concurrent('reviewer identity still excludes admins', () => {
  it('leaves an admin holding only decisions ADMIN out of the eligible reviewers', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;
    const actorOptions = {
      testData,
      organization: setup.organization,
      instanceProfileId: instance.profileId,
    };

    const admin = await createAdminOnlyActor(actorOptions);
    const reviewer = await createBitHolderActor({
      ...actorOptions,
      behaviourBit: TEST_PERMISSION_BITS.REVIEW,
      roleName: 'Reviewer',
    });

    const adminCaller = await createAuthenticatedCaller(admin.email);

    const result = await adminCaller.decision.listEligibleReviewers({
      processInstanceId: instance.instance.id,
    });
    const ids = result.items.map((item) => item.id);

    expect(ids).toContain(reviewer.profileId);
    expect(ids).not.toContain(admin.profileId);
  });

  it('rejects an admin reading a review assignment held by another reviewer', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const scenario = await testData.createReviewAssignment();

    // The seeded Member role this actor starts with carries no REVIEW bit, so
    // only the admin role added on top can pass the widened gate.
    const member = await testData.createInstanceMember(scenario.context);
    await grantInstanceAdminOnlyRole({
      instanceProfileId: scenario.context.instance.profileId,
      authUserId: member.authUserId,
      email: member.email,
    });

    const adminCaller = await createAuthenticatedCaller(member.email);

    await expect(
      adminCaller.decision.getReviewAssignment({
        assignmentId: scenario.assignment.id,
      }),
    ).rejects.toThrow(/access to this review assignment/);
  });
});
