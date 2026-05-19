import { trackProposalReviewed, trackReviewListFinished } from '@op/analytics';
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
import { assertReviewAssignmentContext } from './reviewHelpers';
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

  if (!context.rubricTemplate) {
    throw new ValidationError('Rubric template not found for this assignment');
  }

  schemaValidator.assertRubricData(context.rubricTemplate, reviewData.answers);

  const submittedAt = new Date().toISOString();

  const { review, remainingCount } = await db.transaction(async (tx) => {
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

    const [remaining] = await tx
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

    return { review: submittedReview, remainingCount: remaining?.value ?? 0 };
  });

  const processInstanceId = context.assignment.processInstanceId;

  waitUntil(
    trackProposalReviewed(
      user.id,
      processInstanceId,
      context.assignment.proposalId,
    ),
  );

  if (remainingCount === 0) {
    waitUntil(trackReviewListFinished(user.id, processInstanceId));
  }

  return {
    review,
    processInstanceId,
  };
}
