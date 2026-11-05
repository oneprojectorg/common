import { db } from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  proposalReviewAssignments,
} from '@op/db/schema';

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

  const reviewers = await db.query.profiles.findMany({
    where: {
      ...(reviewerProfileIds && { id: { in: [...reviewerProfileIds] } }),
      reviewerAssignments: {
        processInstanceId,
        phaseId,
        status: { in: OPEN_ASSIGNMENT_STATUSES },
        deletedAt: { isNull: true },
      },
    },
    columns: { id: true },
    extras: {
      remainingCount: (table, { sql }) =>
        sql<number>`(
          select count(*)::int
          from ${proposalReviewAssignments}
          where ${proposalReviewAssignments.reviewerProfileId} = ${table.id}
            and ${proposalReviewAssignments.processInstanceId} = ${processInstanceId}
            and ${proposalReviewAssignments.phaseId} = ${phaseId}
            and ${proposalReviewAssignments.status} in ${OPEN_ASSIGNMENT_STATUSES}
            and ${proposalReviewAssignments.deletedAt} is null
        )`.as('remaining_count'),
    },
    orderBy: { id: 'asc' },
  });

  return reviewers.map(({ id, remainingCount }) => ({
    reviewerProfileId: id,
    remainingCount,
  }));
}
