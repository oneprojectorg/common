import {
  type SQL,
  and,
  db,
  eq,
  exists,
  gt,
  gte,
  inArray,
  lt,
  ne,
  notInArray,
  sql,
} from '@op/db/client';
import {
  ProposalReviewState,
  proposalHistory,
  proposalReviewAssignments,
  proposalReviews,
  proposals,
} from '@op/db/schema';

import type { ReviewProposalStatus } from '../schemas/reviews';

/** Counts by the same rules as the review aggregates and `isReviewOutOfDate`. */
export function reviewCountsByProposal({
  processInstanceId,
  phaseIds,
}: {
  processInstanceId: string;
  phaseIds: string[];
}) {
  // A review with no anchor on either side is not stale.
  const isAnchorStale = exists(
    db
      .select({ historyId: proposalHistory.historyId })
      .from(proposalHistory)
      .where(
        and(
          eq(proposalHistory.id, proposalReviewAssignments.proposalId),
          sql`upper(${proposalHistory.validDuring}) is null`,
          ne(
            proposalHistory.historyId,
            sql`coalesce(${proposalReviews.reviewedProposalHistoryId}, ${proposalReviewAssignments.assignedProposalHistoryId})`,
          ),
        ),
      ),
  );

  return db
    .select({
      proposalId: proposalReviewAssignments.proposalId,
      submitted:
        sql<number>`(count(${proposalReviews.id}) filter (where ${proposalReviews.state} = ${ProposalReviewState.SUBMITTED}))::int`.as(
          'submitted_count',
        ),
      assigned: sql<number>`count(*)::int`.as('assigned_count'),
      outOfDate:
        sql<number>`(count(${proposalReviews.id}) filter (where ${proposalReviews.state} = ${ProposalReviewState.SUBMITTED} and ${isAnchorStale}))::int`.as(
          'out_of_date_count',
        ),
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

export function hasReviewStatus({
  proposalsTable,
  processInstanceId,
  phaseIds,
  status,
}: {
  proposalsTable: typeof proposals;
  processInstanceId: string;
  phaseIds: string[];
  status: ReviewProposalStatus;
}): SQL {
  const counts = reviewCountsByProposal({ processInstanceId, phaseIds });
  const proposalIdsWhere = (condition: SQL | undefined) =>
    db.select({ proposalId: counts.proposalId }).from(counts).where(condition);

  switch (status) {
    case 'unassigned':
      return notInArray(proposalsTable.id, proposalIdsWhere(undefined));
    case 'outOfDate':
      return inArray(
        proposalsTable.id,
        proposalIdsWhere(gt(counts.outOfDate, 0)),
      );
    case 'none':
      return inArray(
        proposalsTable.id,
        proposalIdsWhere(eq(counts.submitted, 0)),
      );
    case 'partial':
      return inArray(
        proposalsTable.id,
        proposalIdsWhere(
          and(
            eq(counts.outOfDate, 0),
            gt(counts.submitted, 0),
            lt(counts.submitted, counts.assigned),
          ),
        ),
      );
    case 'reviewed':
      return inArray(
        proposalsTable.id,
        proposalIdsWhere(
          and(eq(counts.outOfDate, 0), gte(counts.submitted, counts.assigned)),
        ),
      );
  }
}
