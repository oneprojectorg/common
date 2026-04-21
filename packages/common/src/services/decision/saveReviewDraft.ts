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
import { assertReviewAssignmentContext } from './reviewHelpers';
import {
  type ProposalReview,
  type RubricReviewData,
  proposalReviewSchema,
} from './schemas/reviews';

/**
 * Persists a draft review for the current reviewer. Idempotent — repeated
 * calls upsert the draft payload without touching submission state. Refuses
 * once the review has been submitted so drafts can't overwrite a final review.
 */
export async function saveReviewDraft({
  assignmentId,
  reviewData,
  user,
}: {
  assignmentId: string;
  reviewData: RubricReviewData;
  user: User;
}): Promise<ProposalReview & { processInstanceId: string }> {
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
        submittedAt: null,
      })
      .onConflictDoUpdate({
        target: proposalReviews.assignmentId,
        set: {
          reviewData,
        },
      })
      .returning();

    if (!draft) {
      throw new CommonError('Failed to save review draft');
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
    ...proposalReviewSchema.parse({
      id: review.id,
      assignmentId: review.assignmentId,
      state: review.state,
      reviewData: review.reviewData,
      overallComment: review.overallComment ?? null,
      submittedAt: review.submittedAt ?? null,
      createdAt: review.createdAt ?? null,
      updatedAt: review.updatedAt ?? null,
    }),
    processInstanceId: context.assignment.processInstanceId,
  };
}
