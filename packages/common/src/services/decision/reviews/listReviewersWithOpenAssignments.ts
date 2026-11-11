import { db } from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  proposalReviewAssignments,
} from '@op/db/schema';
import { and, asc, count, inArray, isNull } from 'drizzle-orm';

import { reviewSetPredicate } from '../phaseEligibility';

export interface ReviewerWithOpenAssignments {
  reviewerProfileId: string;
  remainingCount: number;
}

const OPEN_ASSIGNMENT_STATUSES = [
  ProposalReviewAssignmentStatus.PENDING,
  ProposalReviewAssignmentStatus.IN_PROGRESS,
  ProposalReviewAssignmentStatus.READY_FOR_RE_REVIEW,
];

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
        // A merged-away proposal is out of the queue, so it earns no reminder.
        reviewSetPredicate(proposalReviewAssignments, {
          processInstanceId,
          phaseId,
        }),
        inArray(proposalReviewAssignments.status, OPEN_ASSIGNMENT_STATUSES),
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
