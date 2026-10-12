import { InngestTestEngine } from '@inngest/test';
import {
  type DecisionSchemaDefinition,
  createDecisionRole,
  listPhaseReviewerSummaries,
  removeProfileUser,
  triggerPhaseAdvancement,
  updateProfileUserRoles,
} from '@op/common';
import {
  TestDecisionsDataManager,
  createProposalReview,
} from '@op/common/testing';
import { db, eq } from '@op/db/client';
import {
  ProcessStatus,
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
  ProposalStatus,
  proposalReviewAssignments,
} from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { Events } from '@op/events';
import { describe, expect, it } from 'vitest';

import { backfillReviewAssignmentsOnRoleChange } from './backfillReviewAssignmentsOnRoleChange';

const decisionSchemaWithReview = {
  id: 'role-change-prune-test-schema',
  version: '1.0.0',
  name: 'Role Change Prune Test Schema',
  description: 'Schema with a review phase for role-change pruning tests',
  config: {
    reviewsPolicy: 'full_coverage' as const,
  },
  phases: [
    {
      id: 'submission',
      name: 'Submission',
      description: 'Submit proposals',
      rules: {
        proposals: { submit: true },
        advancement: { method: 'manual' as const },
      },
      selectionPipeline: { version: '1.0.0', blocks: [] },
    },
    {
      id: 'review',
      name: 'Review',
      description: 'Review proposals',
      rules: {
        proposals: { review: true, submit: true },
        advancement: { method: 'manual' as const },
      },
    },
    {
      id: 'results',
      name: 'Results',
      description: 'Final results',
      rules: {
        proposals: { submit: false },
        advancement: { method: 'manual' as const },
      },
    },
  ],
} satisfies DecisionSchemaDefinition;

const createReviewerRole = (instanceProfileId: string, name: string) =>
  createDecisionRole({
    name,
    profileId: instanceProfileId,
    permissions: {
      decisions: {
        type: 'decision',
        value: {
          create: false,
          read: true,
          update: false,
          delete: false,
          admin: false,
          inviteMembers: false,
          review: true,
          submitProposals: false,
          vote: false,
        },
      },
    },
  });

/**
 * A published decision with one member who holds the given extra roles on top
 * of the member role, and two submitted proposals by other authors. Advancing
 * into review under full coverage assigns both proposals to the member.
 */
async function createReviewerWithAssignments(
  testData: TestDecisionsDataManager,
  roleNames: string[],
) {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    processSchema: decisionSchemaWithReview,
    status: ProcessStatus.PUBLISHED,
  });
  const instance = setup.instance;
  const roles = await Promise.all(
    roleNames.map((name) => createReviewerRole(instance.profileId, name)),
  );

  const [reviewer, otherAuthor] = await Promise.all([
    testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    }),
    testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    }),
  ]);
  for (const role of roles) {
    await testData.assignRole(reviewer.authUserId, instance.profileId, role.id);
  }

  await Promise.all([
    testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Proposal by the creator' },
      status: ProposalStatus.SUBMITTED,
    }),
    testData.createProposal({
      userEmail: otherAuthor.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Proposal by another member' },
      status: ProposalStatus.SUBMITTED,
    }),
  ]);

  await triggerPhaseAdvancement({
    instanceId: instance.instance.id,
    user: setup.user,
    fromPhaseId: 'submission',
  });

  const decisionProfileUser = await db.query.profileUsers.findFirst({
    where: { profileId: instance.profileId, authUserId: reviewer.authUserId },
    with: { roles: true },
  });
  if (!decisionProfileUser) {
    throw new Error('Expected a decision profileUser for the reviewer');
  }

  const assignments = await getReviewerAssignments(
    instance.instance.id,
    reviewer.profileId,
  );
  expect(assignments).toHaveLength(2);

  return { setup, instance, reviewer, decisionProfileUser, roles, assignments };
}

async function getReviewerAssignments(
  instanceId: string,
  reviewerProfileId: string,
) {
  const rows = await db
    .select()
    .from(proposalReviewAssignments)
    .where(eq(proposalReviewAssignments.processInstanceId, instanceId));
  return rows.filter((row) => row.reviewerProfileId === reviewerProfileId);
}

const sortedIds = (rows: { id: string }[]) => rows.map((row) => row.id).sort();

const executeRolesChanged = (data: {
  decisionProfileId: string;
  authUserId: string;
  addedRoleIds: string[];
  removedRoleIds: string[];
}) =>
  new InngestTestEngine({
    function: backfillReviewAssignmentsOnRoleChange,
  }).execute({
    events: [{ name: Events.decisionMemberRolesChanged.name, data }],
  });

describe('backfillReviewAssignmentsOnRoleChange on a role removal', () => {
  it('drops a member with only pending assignments from the phase reviewer list', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, reviewer, decisionProfileUser, roles } =
      await createReviewerWithAssignments(testData, ['Reviewer']);
    const [reviewerRole] = roles;
    if (!reviewerRole) {
      throw new Error('Expected one reviewer role');
    }

    await updateProfileUserRoles({
      profileUserId: decisionProfileUser.id,
      roleIds: [ROLES.MEMBER.id],
      user: setup.user,
    });

    await executeRolesChanged({
      decisionProfileId: instance.profileId,
      authUserId: reviewer.authUserId,
      addedRoleIds: [],
      removedRoleIds: [reviewerRole.id],
    });

    const remaining = await getReviewerAssignments(
      instance.instance.id,
      reviewer.profileId,
    );
    expect(remaining).toEqual([]);

    const summaries = await listPhaseReviewerSummaries({
      user: setup.user,
      processInstanceId: instance.instance.id,
      phaseId: 'review',
    });
    expect(summaries.items.map((row) => row.reviewer.id)).not.toContain(
      reviewer.profileId,
    );
  });

  it('drops a member removed from the process from the phase reviewer list', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, reviewer, decisionProfileUser } =
      await createReviewerWithAssignments(testData, ['Reviewer']);
    const heldRoleIds = decisionProfileUser.roles.map((r) => r.accessRoleId);
    expect(heldRoleIds).toContain(ROLES.MEMBER.id);
    expect(heldRoleIds).toHaveLength(2);

    await removeProfileUser({
      profileUserId: decisionProfileUser.id,
      user: setup.user,
    });

    await executeRolesChanged({
      decisionProfileId: instance.profileId,
      authUserId: reviewer.authUserId,
      addedRoleIds: [],
      removedRoleIds: heldRoleIds,
    });

    const remaining = await getReviewerAssignments(
      instance.instance.id,
      reviewer.profileId,
    );
    expect(remaining).toEqual([]);

    const summaries = await listPhaseReviewerSummaries({
      user: setup.user,
      processInstanceId: instance.instance.id,
      phaseId: 'review',
    });
    expect(summaries.items.map((row) => row.reviewer.id)).not.toContain(
      reviewer.profileId,
    );
  });

  it('prunes the pending assignments of a member who lost the review capability and keeps the started one', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const {
      setup,
      instance,
      reviewer,
      decisionProfileUser,
      roles,
      assignments,
    } = await createReviewerWithAssignments(testData, ['Reviewer']);
    const [reviewerRole] = roles;
    const [started, pending] = assignments;
    if (!reviewerRole || !started || !pending) {
      throw new Error('Expected one reviewer role and two assignments');
    }

    await db
      .update(proposalReviewAssignments)
      .set({ status: ProposalReviewAssignmentStatus.IN_PROGRESS })
      .where(eq(proposalReviewAssignments.id, started.id));
    await createProposalReview({ assignmentId: started.id });

    await updateProfileUserRoles({
      profileUserId: decisionProfileUser.id,
      roleIds: [ROLES.MEMBER.id],
      user: setup.user,
    });

    await executeRolesChanged({
      decisionProfileId: instance.profileId,
      authUserId: reviewer.authUserId,
      addedRoleIds: [],
      removedRoleIds: [reviewerRole.id],
    });

    const remaining = await getReviewerAssignments(
      instance.instance.id,
      reviewer.profileId,
    );
    expect(remaining.map((row) => row.id)).toEqual([started.id]);
    expect(remaining[0]?.status).toBe(
      ProposalReviewAssignmentStatus.IN_PROGRESS,
    );

    const draft = await db.query.proposalReviews.findFirst({
      where: { assignmentId: started.id },
    });
    expect(draft?.state).toBe(ProposalReviewState.DRAFT);
  });

  it('keeps every assignment when the member still holds another role with review', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const {
      setup,
      instance,
      reviewer,
      decisionProfileUser,
      roles,
      assignments,
    } = await createReviewerWithAssignments(testData, [
      'Reviewer',
      'Senior Reviewer',
    ]);
    const [removedRole, keptRole] = roles;
    if (!removedRole || !keptRole) {
      throw new Error('Expected two reviewer roles');
    }

    await updateProfileUserRoles({
      profileUserId: decisionProfileUser.id,
      roleIds: [ROLES.MEMBER.id, keptRole.id],
      user: setup.user,
    });

    await executeRolesChanged({
      decisionProfileId: instance.profileId,
      authUserId: reviewer.authUserId,
      addedRoleIds: [],
      removedRoleIds: [removedRole.id],
    });

    const after = await getReviewerAssignments(
      instance.instance.id,
      reviewer.profileId,
    );
    expect(sortedIds(after)).toEqual(sortedIds(assignments));
  });

  it('keeps every assignment when the removed role never carried review', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const {
      setup,
      instance,
      reviewer,
      decisionProfileUser,
      roles,
      assignments,
    } = await createReviewerWithAssignments(testData, ['Reviewer']);
    const [reviewerRole] = roles;
    if (!reviewerRole) {
      throw new Error('Expected one reviewer role');
    }
    expect(decisionProfileUser.roles.map((r) => r.accessRoleId)).toContain(
      ROLES.MEMBER.id,
    );

    await updateProfileUserRoles({
      profileUserId: decisionProfileUser.id,
      roleIds: [reviewerRole.id],
      user: setup.user,
    });

    await executeRolesChanged({
      decisionProfileId: instance.profileId,
      authUserId: reviewer.authUserId,
      addedRoleIds: [],
      removedRoleIds: [ROLES.MEMBER.id],
    });

    const after = await getReviewerAssignments(
      instance.instance.id,
      reviewer.profileId,
    );
    expect(sortedIds(after)).toEqual(sortedIds(assignments));
  });
});
