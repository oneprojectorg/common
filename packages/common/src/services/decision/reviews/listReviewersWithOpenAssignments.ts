import { db } from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  proposalReviewAssignments,
} from '@op/db/schema';
import { and, asc, count, eq, inArray, isNull } from 'drizzle-orm';

import { notSuperseded } from '../proposalSupersession';

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
        eq(proposalReviewAssignments.processInstanceId, processInstanceId),
        eq(proposalReviewAssignments.phaseId, phaseId),
        inArray(proposalReviewAssignments.status, OPEN_ASSIGNMENT_STATUSES),
        isNull(proposalReviewAssignments.deletedAt),
        // A merged-away proposal is out of the queue, so it earns no reminder.
        notSuperseded({
          proposalId: proposalReviewAssignments.proposalId,
          processInstanceId,
        }),
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
