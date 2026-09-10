import { and, db, eq } from '@op/db/client';
import {
  type ProposalReview,
  ProposalReviewState,
  proposalReviews,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { ValidationError } from '../../utils';
import { getCurrentProposalHistoryIdForAssignment } from './proposal/history';
import {
  assertReviewAssignmentContext,
  assertReviewAssignmentPhaseIsCurrent,
} from './reviewHelpers';
import { schemaValidator } from './schemaValidator';
import type { RubricReviewData } from './schemas/reviews';

/**
 * Edits an already-submitted review in place — no version history — leaving
 * `submittedAt`, `state`, and the assignment status untouched (`updatedAt`
 * advances, so an edit stays derivable). Only while the assignment's phase is
 * still the instance's current phase; frozen once the process advances past it.
 *
 * The review's anchor is re-stamped to the proposal's current version — an edit
 * judges the proposal as it stands now. The assignment's pin is untouched.
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

  const updatedReview = await db.transaction(async (tx) => {
    const currentProposalHistoryId =
      await getCurrentProposalHistoryIdForAssignment({
        assignment: context.assignment,
        db: tx,
      });

    const [row] = await tx
      .update(proposalReviews)
      .set({
        reviewData,
        overallComment: overallComment ?? null,
        ...(currentProposalHistoryId && {
          reviewedProposalHistoryId: currentProposalHistoryId,
        }),
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
