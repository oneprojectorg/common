import { db } from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  proposalReviewAssignments,
} from '@op/db/schema';
import { and, asc, count, eq, inArray, isNull } from 'drizzle-orm';

export interface ReviewerWithOpenAssignments {
  reviewerProfileId: string;
  remainingCount: number;
}

/**
 * Reviewers with open assignments in one instance and phase, in profile id
 * order. When `reviewerProfileIds` is given, only those reviewers count. The
 * caller decides how to reach them.
 */
export async function listReviewersWithOpenAssignments({
  processInstanceId,
  phaseId,
  reviewerProfileIds,
}: {
  processInstanceId: string;
  phaseId: string;
  reviewerProfileIds?: ReadonlyArray<string>;
}): Promise<Array<ReviewerWithOpenAssignments>> {
  if (reviewerProfileIds?.length === 0) {
    return [];
  }

  return db
    .select({
      reviewerProfileId: proposalReviewAssignments.reviewerProfileId,
      remainingCount: count(),
    })
    .from(proposalReviewAssignments)
    .where(
      and(
        eq(proposalReviewAssignments.processInstanceId, processInstanceId),
        eq(proposalReviewAssignments.phaseId, phaseId),
        inArray(proposalReviewAssignments.status, [
          ProposalReviewAssignmentStatus.PENDING,
          ProposalReviewAssignmentStatus.IN_PROGRESS,
          ProposalReviewAssignmentStatus.READY_FOR_RE_REVIEW,
        ]),
        isNull(proposalReviewAssignments.deletedAt),
        reviewerProfileIds
          ? inArray(proposalReviewAssignments.reviewerProfileId, [
              ...reviewerProfileIds,
            ])
          : undefined,
      ),
    )
    .groupBy(proposalReviewAssignments.reviewerProfileId)
    .orderBy(asc(proposalReviewAssignments.reviewerProfileId));
}
