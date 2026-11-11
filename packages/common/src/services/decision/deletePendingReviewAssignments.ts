import { type DbClient, and, eq, inArray } from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  proposalReviewAssignments,
} from '@op/db/schema';

export type PendingReviewAssignmentFilter =
  | {
      assignmentIds: string[];
      proposalIds?: never;
      reviewerProfileId?: never;
      wholePhase?: never;
    }
  | {
      assignmentIds?: never;
      proposalIds: string[];
      reviewerProfileId?: never;
      wholePhase?: never;
    }
  | {
      assignmentIds?: never;
      proposalIds?: never;
      reviewerProfileId: string;
      wholePhase?: never;
    }
  | {
      assignmentIds?: never;
      proposalIds?: never;
      reviewerProfileId?: never;
      wholePhase: true;
    };

export type DeletePendingReviewAssignmentsInput = {
  db: DbClient;
  processInstanceId: string;
  phaseId: string;
} & PendingReviewAssignmentFilter;

/** Started rows are kept: their reviews cascade on delete. No auth check. */
export async function deletePendingReviewAssignments(
  input: DeletePendingReviewAssignmentsInput,
): Promise<string[]> {
  if (input.assignmentIds?.length === 0 || input.proposalIds?.length === 0) {
    return [];
  }

  const deleted = await input.db
    .delete(proposalReviewAssignments)
    .where(
      and(
        eq(
          proposalReviewAssignments.processInstanceId,
          input.processInstanceId,
        ),
        eq(proposalReviewAssignments.phaseId, input.phaseId),
        eq(
          proposalReviewAssignments.status,
          ProposalReviewAssignmentStatus.PENDING,
        ),
        getFilterCondition(input),
      ),
    )
    .returning({ id: proposalReviewAssignments.id });

  return deleted.map((row) => row.id);
}

function getFilterCondition(filter: PendingReviewAssignmentFilter) {
  if (filter.assignmentIds) {
    return inArray(proposalReviewAssignments.id, filter.assignmentIds);
  }
  if (filter.proposalIds) {
    return inArray(proposalReviewAssignments.proposalId, filter.proposalIds);
  }
  if (filter.reviewerProfileId) {
    return eq(
      proposalReviewAssignments.reviewerProfileId,
      filter.reviewerProfileId,
    );
  }
  return undefined;
}
