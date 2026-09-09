import { createIsolatedSession } from '@op/common/testing';
import { TestDecisionsDataManager } from '@op/common/testing/helpers/TestDecisionsDataManager';
import { TestReviewsDataManager } from '@op/common/testing/helpers/TestReviewsDataManager';
import {
  ProposalRelationshipType,
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
  profileUserToAccessRoles,
  profiles,
  proposalRelationships,
} from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { db } from '@op/db/test';
import { createProposalReview } from '@op/test';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { createTestContextWithSession } from '../../../test/caller';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectFailsAccessTierGate,
} from '../../../test/helpers/gating/decision';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

describe.concurrent('decision.listReviewerAssignments', () => {
  it('returns the reviewer header and their own assignments in the shared item shape', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: `Scoped proposal ${task.id}`,
      status: ProposalReviewAssignmentStatus.IN_PROGRESS,
    });
    const context = created.context;

    await createProposalReview({
      assignmentId: created.assignment.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: { answers: {}, rationales: {} },
      submittedAt: new Date().toISOString(),
    });

    // The fixture leaves the profile's contact email unset.
    await db
      .update(profiles)
      .set({ email: `reviewer-${task.id}@example.org` })
      .where(eq(profiles.id, context.defaultReviewer.profileId));

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.listReviewerAssignments({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      reviewerProfileId: context.defaultReviewer.profileId,
    });

    expect(result.reviewer?.id).toBe(context.defaultReviewer.profileId);
    expect(result.reviewer?.email).toBe(`reviewer-${task.id}@example.org`);
    expect(result.isEligible).toBe(true);
    expect(result.assignments).toHaveLength(1);
    const [item] = result.assignments;
    expect(item?.assignment.proposal.id).toBe(created.proposal.id);
    expect(item?.assignment.proposal.profile.name).toBe(
      `Scoped proposal ${task.id}`,
    );
    expect(item?.assignment.status).toBe(
      ProposalReviewAssignmentStatus.IN_PROGRESS,
    );
    expect(item?.review?.state).toBe(ProposalReviewState.SUBMITTED);
    expect(item?.assignment.proposal.submittedBy?.id).toBe(
      created.author.profileId,
    );
  });

  it('excludes other reviewers assignments from the scoped queue', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: `Shared proposal ${task.id}`,
      status: ProposalReviewAssignmentStatus.PENDING,
    });
    const context = created.context;

    const other = await testData.createInstanceReviewerWithRole(context);
    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );
    await adminCaller.decision.assignReviews({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      reviewerProfileId: other.profileId,
      proposalIds: [created.proposal.id],
    });

    const result = await adminCaller.decision.listReviewerAssignments({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      reviewerProfileId: other.profileId,
    });

    // Both reviewers hold it; the scoped read returns one row.
    expect(result.assignedCount).toBe(1);
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0]?.assignment.proposal.id).toBe(
      created.proposal.id,
    );
    expect(result.reviewer?.id).toBe(other.profileId);
  });

  it('reports the header totals across submitted, draft and untouched assignments', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const submitted = await testData.createReviewAssignment({
      title: `Submitted proposal ${task.id}`,
      status: ProposalReviewAssignmentStatus.COMPLETED,
    });
    const context = submitted.context;
    const draft = await testData.createReviewAssignment({
      context,
      title: `Draft proposal ${task.id}`,
      status: ProposalReviewAssignmentStatus.IN_PROGRESS,
    });
    await testData.createReviewAssignment({
      context,
      title: `Untouched proposal ${task.id}`,
      status: ProposalReviewAssignmentStatus.PENDING,
    });

    const submittedAt = new Date().toISOString();
    await createProposalReview({
      assignmentId: submitted.assignment.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: { answers: {}, rationales: {} },
      submittedAt,
    });
    await createProposalReview({
      assignmentId: draft.assignment.id,
      state: ProposalReviewState.DRAFT,
      reviewData: { answers: {}, rationales: {} },
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.listReviewerAssignments({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      reviewerProfileId: context.defaultReviewer.profileId,
    });

    expect(result.assignedCount).toBe(3);
    expect(result.submittedCount).toBe(1);
    expect(result.draftCount).toBe(1);
    // Postgres' own text form, so compare the instant, not the string.
    expect(new Date(result.lastSubmittedAt ?? '').toISOString()).toBe(
      submittedAt,
    );
    // The review's state wins over the assignment's status, as on the cards.
    expect(result.statusBreakdown).toEqual(
      expect.arrayContaining([
        { status: ProposalReviewState.SUBMITTED, count: 1 },
        { status: ProposalReviewState.DRAFT, count: 1 },
        { status: ProposalReviewAssignmentStatus.PENDING, count: 1 },
      ]),
    );
    expect(result.statusBreakdown).toHaveLength(3);
    expect(result.assignments).toHaveLength(3);
    expect(result.total).toBe(3);
    expect(result.next).toBeNull();
  });

  it('pages the queue by cursor while the totals describe the whole queue', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const first = await testData.createReviewAssignment({
      title: `Paged proposal 1 ${task.id}`,
      assignedAt: '2026-01-01T00:00:00.000Z',
    });
    const context = first.context;
    const second = await testData.createReviewAssignment({
      context,
      title: `Paged proposal 2 ${task.id}`,
      assignedAt: '2026-01-02T00:00:00.000Z',
    });
    const third = await testData.createReviewAssignment({
      context,
      title: `Paged proposal 3 ${task.id}`,
      assignedAt: '2026-01-03T00:00:00.000Z',
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );
    const input = {
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      reviewerProfileId: context.defaultReviewer.profileId,
      limit: 2,
    };

    const page1 = await adminCaller.decision.listReviewerAssignments(input);
    expect(page1.assignments).toHaveLength(2);
    expect(page1.total).toBe(3);
    expect(page1.assignedCount).toBe(3);
    expect(page1.next).not.toBeNull();

    const page2 = await adminCaller.decision.listReviewerAssignments({
      ...input,
      cursor: page1.next,
    });
    expect(page2.assignments).toHaveLength(1);
    expect(page2.total).toBe(3);
    expect(page2.next).toBeNull();

    const ids = [...page1.assignments, ...page2.assignments].map(
      (item) => item.assignment.id,
    );
    expect(ids).toEqual(
      [first, second, third].map((created) => created.assignment.id),
    );
  });

  it('keeps a merged-away assignment in the totals while the page drops it', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const merged = await testData.createReviewAssignment({
      title: `Merged away proposal ${task.id}`,
    });
    const context = merged.context;
    // Same context, so the same reviewer holds both assignments.
    const survivor = await testData.createReviewAssignment({
      context,
      title: `Surviving proposal ${task.id}`,
    });
    const instanceId = context.instance.instance.id;

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const before = await adminCaller.decision.listReviewerAssignments({
      processInstanceId: instanceId,
      phaseId: 'review',
      reviewerProfileId: context.defaultReviewer.profileId,
    });
    expect(before.assignments).toHaveLength(2);

    // The edge directly: the read is what's under test, not mergeProposals.
    await db.insert(proposalRelationships).values({
      processInstanceId: instanceId,
      sourceProposalId: merged.proposal.id,
      targetProposalId: survivor.proposal.id,
      relationshipType: ProposalRelationshipType.MERGED,
    });

    const after = await adminCaller.decision.listReviewerAssignments({
      processInstanceId: instanceId,
      phaseId: 'review',
      reviewerProfileId: context.defaultReviewer.profileId,
    });

    expect(
      after.assignments.map((entry) => entry.assignment.proposal.id),
    ).toEqual([survivor.proposal.id]);
    // The page drops it via notSuperseded; the totals still count the work
    // the reviewer did on the merged-away proposal, on purpose.
    expect(after.total).toBe(1);
    expect(after.assignedCount).toBe(2);
  });

  it('withholds the identity of a profile with no tie to the process', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    // An admin who guesses a UUID must not read back a name or email, even
    // for an org member: only a grant on the instance profile counts.
    const decisions = new TestDecisionsDataManager(task.id, onTestFinished);
    const outsider = await decisions.createMemberUser({
      organization: context.organization,
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.listReviewerAssignments({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      reviewerProfileId: outsider.profileId,
    });

    expect(result.reviewer).toBeNull();
    expect(result.isEligible).toBe(false);
    expect(result.assignments).toEqual([]);
  });

  it('does not let an assignment in another phase count as a tie to this phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    const decisions = new TestDecisionsDataManager(task.id, onTestFinished);
    const outsider = await decisions.createMemberUser({
      organization: context.organization,
    });

    await testData.createReviewAssignment({
      context,
      reviewer: outsider,
      phaseId: 'voting',
      title: `Other phase proposal ${task.id}`,
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );
    const input = {
      processInstanceId: context.instance.instance.id,
      reviewerProfileId: outsider.profileId,
    };

    const result = await adminCaller.decision.listReviewerAssignments({
      ...input,
      phaseId: 'review',
    });

    // The phase-scoped totals are what unlock identity, so an assignment in
    // another phase must not name the profile here.
    expect(result.reviewer).toBeNull();
    expect(result.isEligible).toBe(false);
    expect(result.assignedCount).toBe(0);
    expect(result.total).toBe(0);
    expect(result.assignments).toEqual([]);

    // Sanity: the fixture really did create the assignment, one phase over.
    const otherPhase = await adminCaller.decision.listReviewerAssignments({
      ...input,
      phaseId: 'voting',
    });
    expect(otherPhase.reviewer?.id).toBe(outsider.profileId);
    expect(otherPhase.assignedCount).toBe(1);
  });

  it('still identifies a reviewer who lost the review role but kept assignments', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    const reviewer = await testData.createInstanceReviewerWithRole(context);
    await testData.createReviewAssignment({
      context,
      reviewer,
      title: `Removed member proposal ${task.id}`,
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );
    const input = {
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      reviewerProfileId: reviewer.profileId,
    };

    const before = await adminCaller.decision.listReviewerAssignments(input);
    expect(before.isEligible).toBe(true);

    const profileUser = await db.query.profileUsers.findFirst({
      where: {
        authUserId: reviewer.authUserId,
        profileId: context.instance.profileId,
      },
    });
    if (!profileUser) {
      throw new Error('No profileUsers row for the instance reviewer');
    }
    await db
      .delete(profileUserToAccessRoles)
      .where(eq(profileUserToAccessRoles.profileUserId, profileUser.id));

    const result = await adminCaller.decision.listReviewerAssignments(input);

    // A removed member is no longer eligible, but their review history must
    // stay visible to the admin, so the header still names them.
    expect(result.reviewer?.id).toBe(reviewer.profileId);
    expect(result.isEligible).toBe(false);
    expect(result.assignedCount).toBe(1);
  });

  it('rejects a phaseId that does not exist on the instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    await expect(
      adminCaller.decision.listReviewerAssignments({
        processInstanceId: context.instance.instance.id,
        phaseId: 'this-phase-does-not-exist',
        reviewerProfileId: context.defaultReviewer.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });

  it('rejects a reviewer who is not an instance admin', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    const reviewer = await testData.createInstanceReviewerWithRole(context);

    const reviewerCaller = await createAuthenticatedCaller(reviewer.email);

    await expect(
      reviewerCaller.decision.listReviewerAssignments({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
        reviewerProfileId: reviewer.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('rejects an org admin with no grant on the instance profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();

    // Org Admin with no role on the instance profile: no org fallback here.
    const decisions = new TestDecisionsDataManager(task.id, onTestFinished);
    const orgAdmin = await decisions.createMemberUser({
      organization: context.organization,
      orgRoleId: ROLES.ADMIN.id,
    });

    const caller = await createAuthenticatedCaller(orgAdmin.email);

    await expect(
      caller.decision.listReviewerAssignments({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
        reviewerProfileId: context.defaultReviewer.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});

describeDecisionAccessTierGating('decision.listReviewerAssignments', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const context = await testData.createContext();

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.listReviewerAssignments({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
          reviewerProfileId: context.defaultReviewer.profileId,
        }),
        'none',
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'rejects anon-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const context = await testData.createContext();

      const caller = await callers.anonJwt();

      await expectFailsAccessTierGate(
        caller.decision.listReviewerAssignments({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
          reviewerProfileId: context.defaultReviewer.profileId,
        }),
        'anon',
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'rejects user-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const context = await testData.createContext();

      const caller = await callers.userJwt();

      await expectFailsAccessTierGate(
        caller.decision.listReviewerAssignments({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
          reviewerProfileId: context.defaultReviewer.profileId,
        }),
        'user',
      );
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const context = await testData.createContext();

      const caller = await callers.networkJwt(context.defaultReviewer.email);

      // Assert it lands: "not Unauthorized" would pass if it never ran.
      const result = await caller.decision.listReviewerAssignments({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
        reviewerProfileId: context.defaultReviewer.profileId,
      });

      expect(result.assignedCount).toBe(0);
      expect(result.assignments).toEqual([]);
    },
  ),
});
