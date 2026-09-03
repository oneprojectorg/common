import {
  ProposalRelationshipType,
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
  profiles,
  proposalRelationships,
  proposals,
} from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { db } from '@op/db/test';
import { createProposalReview } from '@op/test';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import { TestReviewsDataManager } from '../../../test/helpers/TestReviewsDataManager';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectFailsAccessTierGate,
} from '../../../test/helpers/gating/decision';
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

describe.concurrent('decision.listReviewerAssignments', () => {
  it('returns the reviewer header, totals and their own assignments', async ({
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
    expect(result.assignedCount).toBe(1);
    expect(result.submittedCount).toBe(1);
    expect(result.draftCount).toBe(0);
    expect(result.lastSubmittedAt).not.toBeNull();
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
    expect(result.assignments).toHaveLength(3);
  });

  it('hides assignments whose proposal was moderation-detached', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: `Detached proposal ${task.id}`,
      status: ProposalReviewAssignmentStatus.PENDING,
    });
    const context = created.context;

    await db
      .update(proposals)
      .set({ moderationDetachedAt: new Date().toISOString() })
      .where(eq(proposals.id, created.proposal.id));

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.listReviewerAssignments({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      reviewerProfileId: context.defaultReviewer.profileId,
    });

    expect(result.assignedCount).toBe(0);
    expect(result.assignments).toEqual([]);
  });

  it('drops an assignment whose proposal was merged away', async ({
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
  });

  it('withholds the identity of a profile with no tie to the process', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    // An admin who guesses a UUID must not read back a name or email.
    const outsider = await testData.createContext();

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.listReviewerAssignments({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      reviewerProfileId: outsider.defaultReviewer.profileId,
    });

    expect(result.reviewer).toBeNull();
    expect(result.isEligible).toBe(false);
    expect(result.assignments).toEqual([]);
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
