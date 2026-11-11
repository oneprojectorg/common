import { type DbClient, and, eq, inArray } from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  proposalReviewAssignments,
} from '@op/db/schema';

export interface DeletePendingReviewAssignmentsInput {
  db: DbClient;
  processInstanceId: string;
  phaseId: string;
  assignmentIds?: string[];
  proposalIds?: string[];
  reviewerProfileId?: string;
}

/** Started rows are kept: their reviews cascade on delete. No auth check. */
export async function deletePendingReviewAssignments({
  db,
  processInstanceId,
  phaseId,
  assignmentIds,
  proposalIds,
  reviewerProfileId,
}: DeletePendingReviewAssignmentsInput): Promise<string[]> {
  if (assignmentIds?.length === 0 || proposalIds?.length === 0) {
    return [];
  }

  const deleted = await db
    .delete(proposalReviewAssignments)
    .where(
      and(
        eq(proposalReviewAssignments.processInstanceId, processInstanceId),
        eq(proposalReviewAssignments.phaseId, phaseId),
        eq(
          proposalReviewAssignments.status,
          ProposalReviewAssignmentStatus.PENDING,
        ),
        assignmentIds
          ? inArray(proposalReviewAssignments.id, assignmentIds)
          : undefined,
        proposalIds
          ? inArray(proposalReviewAssignments.proposalId, proposalIds)
          : undefined,
        reviewerProfileId
          ? eq(proposalReviewAssignments.reviewerProfileId, reviewerProfileId)
          : undefined,
      ),
    )
    .returning({ id: proposalReviewAssignments.id });

  return deleted.map((row) => row.id);
}
