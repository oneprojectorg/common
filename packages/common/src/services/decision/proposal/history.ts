import { type DbClient, db as defaultDb, sql } from '@op/db/client';
import type { ProposalReviewAssignment } from '@op/db/schema';

/**
 * The current (open temporal range) history row id per proposal, in one query
 * so list reads never fan out per proposal.
 */
export async function getCurrentProposalHistoryIds({
  proposalIds,
  db = defaultDb,
}: {
  proposalIds: string[];
  db?: DbClient;
}): Promise<Map<string, string>> {
  if (proposalIds.length === 0) {
    return new Map();
  }

  // `proposalHistory.id` is the proposal's own id; `historyId` is the snapshot PK.
  const rows = await db.query.proposalHistory.findMany({
    where: {
      id: { in: proposalIds },
      RAW: (table) => sql`upper(${table.validDuring}) IS NULL`,
    },
    columns: { id: true, historyId: true },
  });

  return new Map(rows.map((row) => [row.id, row.historyId]));
}

/**
 * Resolved from the assignment so a review can only anchor to its own proposal.
 * `null` when the proposal has no open history row: the history trigger fires
 * only after an update and was never backfilled, so an unedited proposal has none.
 */
export async function getCurrentProposalHistoryIdForAssignment({
  assignment,
  db = defaultDb,
}: {
  assignment: Pick<ProposalReviewAssignment, 'proposalId'>;
  db?: DbClient;
}): Promise<string | null> {
  const byProposal = await getCurrentProposalHistoryIds({
    proposalIds: [assignment.proposalId],
    db,
  });

  return byProposal.get(assignment.proposalId) ?? null;
}
