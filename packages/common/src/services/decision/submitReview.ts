import { trackReviewQueueCompleted, trackReviewSubmitted } from '@op/analytics';
import { and, db, eq, ne } from '@op/db/client';
import {
  type ProposalReview,
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
  proposalReviewAssignments,
  proposalReviews,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { waitUntil } from '@vercel/functions';
import { count } from 'drizzle-orm';

import { CommonError, ValidationError } from '../../utils';
import { getRubricScoringInfo } from './getRubricScoringInfo';
import { getSubmittedReviewScore } from './listProposalsWithReviewAggregates';
import {
  assertReviewAssignmentContext,
  assertReviewAssignmentPhaseIsCurrent,
} from './reviewHelpers';
import { schemaValidator } from './schemaValidator';
import type { RubricReviewData } from './schemas/reviews';

/** Validates and submits a review for the current reviewer. */
export async function submitReview({
  assignmentId,
  reviewData,
  overallComment,
  user,
}: {
  assignmentId: string;
  reviewData: RubricReviewData;
  overallComment?: string | null;
  user: User;
}): Promise<{ review: ProposalReview; processInstanceId: string }> {
  const context = await assertReviewAssignmentContext({
    assignmentId,
    user,
  });

  if (
    context.assignment.status === ProposalReviewAssignmentStatus.COMPLETED ||
    context.review?.state === ProposalReviewState.SUBMITTED
  ) {
    throw new ValidationError('Review has already been submitted');
  }

  assertReviewAssignmentPhaseIsCurrent(
    context.instance,
    context.assignment.phaseId,
  );

  if (!context.rubricTemplate) {
    throw new ValidationError('Rubric template not found for this assignment');
  }

  schemaValidator.assertRubricData(context.rubricTemplate, reviewData.answers);

  const submittedAt = new Date().toISOString();

  const review = await db.transaction(async (tx) => {
    const [submittedReview] = await tx
      .insert(proposalReviews)
      .values({
        assignmentId,
        state: ProposalReviewState.SUBMITTED,
        reviewData,
        overallComment: overallComment ?? null,
        submittedAt,
      })
      .onConflictDoUpdate({
        target: proposalReviews.assignmentId,
        set: {
          state: ProposalReviewState.SUBMITTED,
          reviewData,
          overallComment: overallComment ?? null,
          submittedAt,
        },
      })
      .returning();

    if (!submittedReview) {
      throw new CommonError('Failed to submit review');
    }

    await tx
      .update(proposalReviewAssignments)
      .set({
        status: ProposalReviewAssignmentStatus.COMPLETED,
        completedAt: submittedAt,
      })
      .where(eq(proposalReviewAssignments.id, assignmentId));

    return submittedReview;
  });

  const processInstanceId = context.assignment.processInstanceId;

  const scoredCriterionKeys = getRubricScoringInfo(context.rubricTemplate)
    .criteria.filter((criterion) => criterion.scored)
    .map((criterion) => criterion.key);
  const scored = getSubmittedReviewScore(review, scoredCriterionKeys);

  const assignedAtMs = context.assignment.assignedAt
    ? Date.parse(context.assignment.assignedAt)
    : Number.NaN;
  const secondsToComplete = Number.isFinite(assignedAtMs)
    ? Math.round((Date.parse(submittedAt) - assignedAtMs) / 1000)
    : null;

  waitUntil(
    trackReviewSubmitted(
      user.id,
      processInstanceId,
      context.assignment.proposalId,
      {
        assignment_id: assignmentId,
        phase_id: context.assignment.phaseId,
        recommendation: scored?.overallRecommendation ?? null,
        score: scored?.score ?? null,
        revision_requested: context.assignment.requests.length > 0,
        seconds_to_complete: secondsToComplete,
      },
    ),
  );

  waitUntil(
    (async () => {
      const [remaining] = await db
        .select({ value: count() })
        .from(proposalReviewAssignments)
        .where(
          and(
            eq(
              proposalReviewAssignments.processInstanceId,
              context.assignment.processInstanceId,
            ),
            eq(
              proposalReviewAssignments.reviewerProfileId,
              context.assignment.reviewerProfileId,
            ),
            ne(
              proposalReviewAssignments.status,
              ProposalReviewAssignmentStatus.COMPLETED,
            ),
          ),
        );

      // Default to 1 (not 0) on a missing row so a count failure cannot
      // falsely trigger review_queue_completed.
      if ((remaining?.value ?? 1) === 0) {
        await trackReviewQueueCompleted(user.id, processInstanceId);
      }
    })(),
  );

  return {
    review,
    processInstanceId,
  };
}
