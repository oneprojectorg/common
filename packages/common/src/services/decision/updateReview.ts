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
  assertReviewAssignmentPhaseIsCurrent,
} from './reviewHelpers';
import { schemaValidator } from './schemaValidator';
import type { RubricReviewData } from './schemas/reviews';

/**
 * Edits an already-submitted review in place while its phase is still current.
 * Also the re-affirm path: the anchor moves to the current proposal version,
 * and `submittedAt` advances only if the review was out of date.
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

  assertReviewAssignmentPhaseIsCurrent(
    context.instance,
    context.assignment.phaseId,
  );

  if (!context.rubricTemplate) {
    throw new ValidationError('Rubric template not found for this assignment');
  }

  schemaValidator.assertRubricData(context.rubricTemplate, reviewData.answers);

  const { currentProposalHistoryId, isReviewOutOfDate: stale } = context;

  const updatedReview = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(proposalReviews)
      .set({
        reviewData,
        overallComment: overallComment ?? null,
        ...(currentProposalHistoryId && {
          reviewedProposalHistoryId: currentProposalHistoryId,
        }),
        ...(stale && { submittedAt: new Date().toISOString() }),
      })
      // Defensive: the row must still be SUBMITTED (nothing un-submits today).
      .where(
        and(
          eq(proposalReviews.assignmentId, assignmentId),
          eq(proposalReviews.state, ProposalReviewState.SUBMITTED),
        ),
      )
      .returning();

    if (!row) {
      throw new ValidationError(
        'This review can no longer be edited; please refresh and try again',
      );
    }

    return row;
  });

  return {
    review: updatedReview,
    processInstanceId: context.assignment.processInstanceId,
  };
}
