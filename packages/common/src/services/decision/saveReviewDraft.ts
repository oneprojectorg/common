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
import { type ProposalReview, proposalReviewSchema } from './schemas/reviews';

/** Saves or updates a draft review for the current reviewer. */
export async function saveReviewDraft({
  assignmentId,
  reviewData,
  overallComment,
  user,
}: {
  assignmentId: string;
  reviewData: Record<string, unknown>;
  overallComment?: string | null;
  user: User;
}): Promise<ProposalReview> {
  const context = await getAuthorizedReviewAssignmentContext({
    assignmentId,
    user,
  });

  if (
    context.assignment.status === ProposalReviewAssignmentStatus.COMPLETED ||
    context.review?.state === ProposalReviewState.SUBMITTED
  ) {
    throw new ValidationError('Submitted reviews cannot be edited');
  }

  const review = await db.transaction(async (tx) => {
    const [savedReview] = await tx
      .insert(proposalReviews)
      .values({
        assignmentId,
        state: ProposalReviewState.DRAFT,
        reviewData,
        overallComment: overallComment ?? null,
      })
      .onConflictDoUpdate({
        target: proposalReviews.assignmentId,
        set: {
          state: ProposalReviewState.DRAFT,
          reviewData,
          overallComment: overallComment ?? null,
          submittedAt: null,
        },
      })
      .returning();

    if (!savedReview) {
      throw new CommonError('Failed to save review draft');
    }

    if (context.assignment.status === ProposalReviewAssignmentStatus.PENDING) {
      await tx
        .update(proposalReviewAssignments)
        .set({
          status: ProposalReviewAssignmentStatus.IN_PROGRESS,
          completedAt: null,
        })
        .where(eq(proposalReviewAssignments.id, assignmentId));
    }

    return savedReview;
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
