import { and, db, eq } from '@op/db/client';
import {
  type ProposalReview,
  ProposalReviewState,
  proposalReviews,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { ValidationError } from '../../utils';
import {
  assertReviewAssignmentPhaseIsCurrent,
  assertReviewAssignmentContext,
} from './reviewHelpers';
import { schemaValidator } from './schemaValidator';
import type { RubricReviewData } from './schemas/reviews';

/**
 * Edits an already-submitted review in place — no version history — leaving
 * `submittedAt`, `state`, and the assignment status untouched (`updatedAt`
 * advances, so an edit stays derivable). Only while the assignment's phase is
 * still the instance's current phase; frozen once the process advances past it.
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

  assertReviewAssignmentPhaseIsCurrent({
    instance: context.instance,
    assignment: context.assignment,
    error: new ValidationError(
      'This review can no longer be edited because the review phase has ended',
    ),
  });

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
    // Defensive: the row must still be SUBMITTED (nothing un-submits today).
    .where(
      and(
        eq(proposalReviews.assignmentId, assignmentId),
        eq(proposalReviews.state, ProposalReviewState.SUBMITTED),
      ),
    )
    .returning();

  if (!updatedReview) {
    throw new ValidationError(
      'This review can no longer be edited; please refresh and try again',
    );
  }

  return {
    review: updatedReview,
    processInstanceId: context.assignment.processInstanceId,
  };
}
