import { and, db, eq } from '@op/db/client';
import {
  type ProposalReview,
  ProposalReviewState,
  proposalReviews,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { ValidationError } from '../../utils';
import {
  assertReviewAssignmentContext,
  canEditSubmittedReview,
} from './reviewHelpers';
import { schemaValidator } from './schemaValidator';
import type { RubricReviewData } from './schemas/reviews';

/**
 * Edits an already-submitted review for the current reviewer. Overwrites the
 * rubric answers and feedback in place — no version history — while leaving
 * `submittedAt`, the review `state`, and the assignment status untouched. The
 * row's `updatedAt` advances on the UPDATE, keeping "was this review edited"
 * derivable (`updatedAt > submittedAt`).
 *
 * Only permitted while the assignment's phase is still the instance's current
 * phase (see {@link canEditSubmittedReview}); once the process advances past
 * the review phase the review is frozen.
 */
export async function updateReview({
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

  if (context.review?.state !== ProposalReviewState.SUBMITTED) {
    throw new ValidationError('Review has not been submitted yet');
  }

  if (
    !canEditSubmittedReview({
      assignment: context.assignment,
      instance: context.instance,
      review: context.review,
    })
  ) {
    throw new ValidationError(
      'This review can no longer be edited because the review phase has ended',
    );
  }

  if (!context.rubricTemplate) {
    throw new ValidationError('Rubric template not found for this assignment');
  }

  schemaValidator.assertRubricData(context.rubricTemplate, reviewData.answers);

  const [updatedReview] = await db
    .update(proposalReviews)
    .set({
      reviewData,
      overallComment: overallComment ?? null,
    })
    // Atomic guard: the row must still be SUBMITTED. If it was concurrently
    // moved off SUBMITTED between the check above and here, the UPDATE matches
    // nothing and `.returning()` is empty — surfaced as the same error.
    .where(
      and(
        eq(proposalReviews.assignmentId, assignmentId),
        eq(proposalReviews.state, ProposalReviewState.SUBMITTED),
      ),
    )
    .returning();

  if (!updatedReview) {
    throw new ValidationError('Review has not been submitted yet');
  }

  return {
    review: updatedReview,
    processInstanceId: context.assignment.processInstanceId,
  };
}
