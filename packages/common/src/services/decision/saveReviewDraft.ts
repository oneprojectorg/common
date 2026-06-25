import { db } from '@op/db/client';
import {
  type ProposalReview,
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
  proposalReviewAssignments,
  proposalReviews,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { eq, ne } from 'drizzle-orm';

import { ValidationError } from '../../utils';
import { assertReviewAssignmentContext } from './reviewHelpers';
import type { RubricReviewData } from './schemas/reviews';

/**
 * Persists a draft review for the current reviewer. Upserts the draft row
 * for the assignment — last write wins — without touching submission state.
 * Refuses once the review has been submitted so drafts can't overwrite a
 * final review.
 */
export async function saveReviewDraft({
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

  const review = await db.transaction(async (tx) => {
    const [draft] = await tx
      .insert(proposalReviews)
      .values({
        assignmentId,
        state: ProposalReviewState.DRAFT,
        reviewData,
        overallComment: overallComment ?? null,
        submittedAt: null,
      })
      .onConflictDoUpdate({
        target: proposalReviews.assignmentId,
        set: {
          reviewData,
          overallComment: overallComment ?? null,
        },
        // Atomic guard against a late-arriving draft overwriting a row that
        // was submitted after this request's early state check passed. When
        // the row is SUBMITTED the UPDATE is skipped and `.returning()` is
        // empty, which we surface as the same ValidationError the sequential
        // path throws.
        setWhere: ne(proposalReviews.state, ProposalReviewState.SUBMITTED),
      })
      .returning();

    if (!draft) {
      throw new ValidationError('Review has already been submitted');
    }

    if (context.assignment.status === ProposalReviewAssignmentStatus.PENDING) {
      await tx
        .update(proposalReviewAssignments)
        .set({
          status: ProposalReviewAssignmentStatus.IN_PROGRESS,
        })
        .where(eq(proposalReviewAssignments.id, assignmentId));
    }

    return draft;
  });

  return {
    review,
    processInstanceId: context.assignment.processInstanceId,
  };
}
