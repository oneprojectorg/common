import { computeDaysLeft } from '@op/common';
import {
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
  processInstances,
  proposalReviewAssignments,
} from '@op/db/schema';
import { db } from '@op/db/test';
import { createProposalReview } from '@op/test';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestReviewsDataManager } from '../../../test/helpers/TestReviewsDataManager';
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

/**
 * Adds a phase entry for `phaseId='review'` so `daysLeft` has an `endDate` to
 * resolve against. The test instance template only ships `initial` and `final`
 * phases, neither of which match the assignment phase used by review fixtures.
 */
async function setReviewPhaseEndDate(instanceId: string, endDate: string) {
  const instanceRecord = await db.query.processInstances.findFirst({
    where: { id: instanceId },
  });
  const instanceData =
    (instanceRecord?.instanceData as { phases?: Array<unknown> } | null) ?? {};
  const phases = Array.isArray(instanceData.phases) ? instanceData.phases : [];
  await db
    .update(processInstances)
    .set({
      instanceData: {
        ...instanceData,
        phases: [...phases, { phaseId: 'review', endDate }],
      },
    })
    .where(eq(processInstances.id, instanceId));
}

describe.concurrent('getReviewProgress', () => {
  it('rejects callers without admin access on the instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    const reviewer = await testData.createInstanceReviewerWithRole(context);

    const reviewerCaller = await createAuthenticatedCaller(reviewer.email);

    await expect(
      reviewerCaller.decision.getReviewProgress({
        processInstanceId: context.instance.instance.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('returns zero counts for an instance with no assignments', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.getReviewProgress({
      processInstanceId: context.instance.instance.id,
    });

    expect(result).toEqual({
      proposalsReviewed: 0,
      proposalsTotal: 0,
      activeReviewers: 0,
      reviewersTotal: 0,
      daysLeft: null,
    });
  });

  it('counts proposals as reviewed only when every assignment is COMPLETED', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    // Single-assignment proposals at three lifecycle stages.
    const [, mixed] = await Promise.all([
      testData.createReviewAssignment({
        context,
        title: 'All completed',
        status: ProposalReviewAssignmentStatus.COMPLETED,
      }),
      testData.createReviewAssignment({
        context,
        title: 'In progress',
        status: ProposalReviewAssignmentStatus.IN_PROGRESS,
      }),
      testData.createReviewAssignment({
        context,
        title: 'Pending',
        status: ProposalReviewAssignmentStatus.PENDING,
      }),
    ]);

    // Add a second reviewer to `mixed` whose assignment is COMPLETED while the
    // first reviewer's is still IN_PROGRESS — proves the "every assignment
    // completed" gate (one COMPLETED out of two isn't enough).
    const secondReviewer = await testData.createReviewer(context);
    await db.insert(proposalReviewAssignments).values({
      processInstanceId: context.instance.instance.id,
      proposalId: mixed.proposal.id,
      reviewerProfileId: secondReviewer.profileId,
      phaseId: 'review',
      status: ProposalReviewAssignmentStatus.COMPLETED,
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.getReviewProgress({
      processInstanceId: context.instance.instance.id,
    });

    expect(result.proposalsTotal).toBe(3);
    expect(result.proposalsReviewed).toBe(1);
  });

  it('counts active reviewers as those with at least one non-PENDING assignment', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    // defaultReviewer: one IN_PROGRESS assignment → active.
    await testData.createReviewAssignment({
      context,
      title: 'Active reviewer assignment',
      status: ProposalReviewAssignmentStatus.IN_PROGRESS,
    });

    // pendingOnlyReviewer: only PENDING assignments → assigned but not active.
    const pendingOnlyReviewer = await testData.createReviewer(context);
    await testData.createReviewAssignment({
      context,
      title: 'Pending-only reviewer assignment',
      reviewer: pendingOnlyReviewer,
      status: ProposalReviewAssignmentStatus.PENDING,
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.getReviewProgress({
      processInstanceId: context.instance.instance.id,
    });

    expect(result.reviewersTotal).toBe(2);
    expect(result.activeReviewers).toBe(1);
  });

  it('treats AWAITING_AUTHOR_REVISION and READY_FOR_RE_REVIEW as active', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    await testData.createReviewAssignment({
      context,
      title: 'Awaiting revision',
      status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    });

    const reReviewReviewer = await testData.createReviewer(context);
    await testData.createReviewAssignment({
      context,
      title: 'Ready for re-review',
      reviewer: reReviewReviewer,
      status: ProposalReviewAssignmentStatus.READY_FOR_RE_REVIEW,
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.getReviewProgress({
      processInstanceId: context.instance.instance.id,
    });

    expect(result.activeReviewers).toBe(2);
    expect(result.reviewersTotal).toBe(2);
  });

  it('counts reviewers and assignments distinctly across multiple proposals', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    // Same default reviewer assigned to two proposals → still 1 distinct reviewer.
    await testData.createReviewAssignment({
      context,
      title: 'Proposal A',
      status: ProposalReviewAssignmentStatus.IN_PROGRESS,
    });
    await testData.createReviewAssignment({
      context,
      title: 'Proposal B',
      status: ProposalReviewAssignmentStatus.COMPLETED,
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.getReviewProgress({
      processInstanceId: context.instance.instance.id,
    });

    expect(result.reviewersTotal).toBe(1);
    expect(result.activeReviewers).toBe(1);
    expect(result.proposalsTotal).toBe(2);
    expect(result.proposalsReviewed).toBe(1);
  });

  it('scopes counts to the requested phase and ignores cross-phase assignments', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    // Review-phase assignment for the default reviewer (active).
    await testData.createReviewAssignment({
      context,
      title: 'Review phase',
      status: ProposalReviewAssignmentStatus.IN_PROGRESS,
    });

    // Stray assignment in a different phase, distinct reviewer — must not
    // contaminate the review-phase counts.
    const otherPhaseReviewer = await testData.createReviewer(context);
    const otherPhaseProposal = await testData.createReviewAssignment({
      context,
      title: 'Other phase',
      reviewer: otherPhaseReviewer,
      status: ProposalReviewAssignmentStatus.COMPLETED,
    });
    await db
      .update(proposalReviewAssignments)
      .set({ phaseId: 'submission' })
      .where(
        eq(proposalReviewAssignments.id, otherPhaseProposal.assignment.id),
      );

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.getReviewProgress({
      processInstanceId: context.instance.instance.id,
    });

    expect(result.reviewersTotal).toBe(1);
    expect(result.activeReviewers).toBe(1);
  });

  it('isolates counts to the requested instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);

    const [primary, foreign] = await Promise.all([
      testData.createReviewAssignment({
        title: 'Primary',
        status: ProposalReviewAssignmentStatus.IN_PROGRESS,
      }),
      testData.createReviewAssignment({
        title: 'Foreign',
        status: ProposalReviewAssignmentStatus.COMPLETED,
      }),
    ]);

    await Promise.all([
      testData.setCurrentPhase(primary.context.instance.instance.id, 'review'),
      testData.setCurrentPhase(foreign.context.instance.instance.id, 'review'),
    ]);

    const adminCaller = await createAuthenticatedCaller(
      primary.context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.getReviewProgress({
      processInstanceId: primary.context.instance.instance.id,
    });

    expect(result.proposalsTotal).toBe(1);
    expect(result.proposalsReviewed).toBe(0);
    expect(result.reviewersTotal).toBe(1);
    expect(result.activeReviewers).toBe(1);
  });

  it('returns daysLeft from the resolved phase endDate', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    const tenDaysOut = new Date(Date.now() + 10 * 86_400_000).toISOString();
    await setReviewPhaseEndDate(context.instance.instance.id, tenDaysOut);

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.getReviewProgress({
      processInstanceId: context.instance.instance.id,
    });

    // Rounding up — 10 days minus a few ms of test overhead still ceils to 10.
    expect(result.daysLeft).toBe(10);
  });

  it('returns null daysLeft when the phase has no endDate', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.getReviewProgress({
      processInstanceId: context.instance.instance.id,
    });

    expect(result.daysLeft).toBeNull();
  });

  it('only flips proposalsReviewed when assignment status — not just review state — is COMPLETED', async ({
    task,
    onTestFinished,
  }) => {
    // A SUBMITTED review row alone does not flip the assignment to COMPLETED;
    // assignment status is the source of truth for "reviewed".
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    const created = await testData.createReviewAssignment({
      context,
      title: 'Submitted but not completed',
      status: ProposalReviewAssignmentStatus.IN_PROGRESS,
    });

    await createProposalReview({
      assignmentId: created.assignment.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: { answers: {}, rationales: {} },
      submittedAt: new Date().toISOString(),
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const before = await adminCaller.decision.getReviewProgress({
      processInstanceId: context.instance.instance.id,
    });
    expect(before.proposalsReviewed).toBe(0);
    expect(before.proposalsTotal).toBe(1);

    await db
      .update(proposalReviewAssignments)
      .set({ status: ProposalReviewAssignmentStatus.COMPLETED })
      .where(eq(proposalReviewAssignments.id, created.assignment.id));

    const after = await adminCaller.decision.getReviewProgress({
      processInstanceId: context.instance.instance.id,
    });
    expect(after.proposalsReviewed).toBe(1);
  });
});

describe('computeDaysLeft', () => {
  const phases = [
    { phaseId: 'review', endDate: '2026-01-15T00:00:00.000Z' },
    { phaseId: 'no-end' },
  ];

  it('rounds up partial days', () => {
    expect(
      computeDaysLeft({
        phaseId: 'review',
        phases,
        now: new Date('2026-01-13T12:00:00.000Z'),
      }),
    ).toBe(2);
  });

  it('returns 0 when the deadline has passed', () => {
    expect(
      computeDaysLeft({
        phaseId: 'review',
        phases,
        now: new Date('2026-02-01T00:00:00.000Z'),
      }),
    ).toBe(0);
  });

  it('returns null when the resolved phase has no endDate', () => {
    expect(
      computeDaysLeft({
        phaseId: 'no-end',
        phases,
        now: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).toBeNull();
  });

  it('returns null when phaseId is undefined', () => {
    expect(
      computeDaysLeft({
        phaseId: undefined,
        phases,
        now: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).toBeNull();
  });

  it('returns null when the phase is not in the phases array', () => {
    expect(
      computeDaysLeft({
        phaseId: 'unknown',
        phases,
        now: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).toBeNull();
  });
});
