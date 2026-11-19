import { and, db, eq, inArray, sql } from '@op/db/client';
import {
  ProposalReviewState,
  proposalReviewAssignments,
  proposalReviews,
} from '@op/db/schema';

/** Counts by the same rule as the review aggregates. */
export function reviewCountsByProposal({
  processInstanceId,
  phaseIds,
}: {
  processInstanceId: string;
  phaseIds: string[];
}) {
  return db
    .select({
      proposalId: proposalReviewAssignments.proposalId,
      submitted:
        sql<number>`(count(${proposalReviews.id}) filter (where ${proposalReviews.state} = ${ProposalReviewState.SUBMITTED}))::int`.as(
          'submitted_count',
        ),
      assigned: sql<number>`count(*)::int`.as('assigned_count'),
    })
    .from(proposalReviewAssignments)
    .leftJoin(
      proposalReviews,
      eq(proposalReviews.assignmentId, proposalReviewAssignments.id),
    )
    .where(
      and(
        eq(proposalReviewAssignments.processInstanceId, processInstanceId),
        inArray(proposalReviewAssignments.phaseId, phaseIds),
      ),
    )
    .groupBy(proposalReviewAssignments.proposalId)
    .as('review_counts');
}
