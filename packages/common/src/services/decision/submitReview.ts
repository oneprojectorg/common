import { db } from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
  proposalReviewAssignments,
  proposalReviews,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { eq } from 'drizzle-orm';

import { CommonError, ValidationError } from '../../utils';
import { getAuthorizedReviewAssignmentContext } from './reviewHelpers';
import { schemaValidator } from './schemaValidator';
import {
  type ProposalReviewData,
  proposalReviewSchema,
} from './schemas/reviews';

/** Validates and submits a review for the current reviewer. */
export async function submitReview({
  assignmentId,
  reviewData,
  overallComment,
  user,
}: {
  assignmentId: string;
  reviewData: Record<string, unknown>;
  overallComment?: string | null;
  user: User;
}): Promise<ProposalReviewData> {
  const context = await getAuthorizedReviewAssignmentContext({
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

  schemaValidator.validateRubricData(context.rubricTemplate, reviewData);

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

  return proposalReviewSchema.parse({
    id: review.id,
    assignmentId: review.assignmentId,
    state: review.state,
    reviewData: review.reviewData,
    overallComment: review.overallComment ?? null,
    submittedAt: review.submittedAt ?? null,
    createdAt: review.createdAt ?? null,
    updatedAt: review.updatedAt ?? null,
  });
}
