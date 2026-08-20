import { and, type db, inArray, sql } from '@op/db/client';
import { ProposalReviewState, proposalHistory } from '@op/db/schema';

/**
 * The `select`-capable slice of the database client, so these reads work both
 * on `db` and inside a `db.transaction` callback.
 */
type HistoryReader = Pick<typeof db, 'select'>;

/**
 * `historyId` of each proposal's *current* history row — the open temporal
 * range (`upper(valid_during) IS NULL`) that the proposals table's history
 * trigger keeps in step with the live row. Keyed by proposal id.
 *
 * One query for the whole set, so list reads never fan out per assignment.
 */
export async function getCurrentProposalHistoryIds(
  proposalIds: string[],
  client: HistoryReader,
): Promise<Map<string, string>> {
  if (proposalIds.length === 0) {
    return new Map();
  }

  // `proposalHistory.id` is the proposal's own id; `historyId` is the PK of the
  // snapshot row.
  const rows = await client
    .select({
      proposalId: proposalHistory.id,
      historyId: proposalHistory.historyId,
    })
    .from(proposalHistory)
    .where(
      and(
        inArray(proposalHistory.id, proposalIds),
        sql`upper(${proposalHistory.validDuring}) IS NULL`,
      ),
    );

  return new Map(rows.map((row) => [row.proposalId, row.historyId]));
}

/** `getCurrentProposalHistoryIds` for a single proposal. */
export async function getCurrentProposalHistoryId(
  proposalId: string,
  client: HistoryReader,
): Promise<string | null> {
  const byProposal = await getCurrentProposalHistoryIds([proposalId], client);

  return byProposal.get(proposalId) ?? null;
}

/**
 * Whether a submitted review is out of date: the proposal has moved on since
 * the reviewer last reviewed it.
 *
 * The assignment's `assignedProposalHistoryId` pin is the anchor — "the version
 * last reviewed", re-stamped on every submit and on every post-submit edit — so
 * staleness is simply "pin ≠ the proposal's current history row". Derived at
 * read time; nothing is stored.
 *
 * Only a SUBMITTED review can be out of date (there is nothing to be stale
 * before the reviewer commits an opinion). A missing pin or a proposal with no
 * open history row means we don't know what was reviewed, so we don't claim
 * staleness.
 */
export function isReviewOutOfDate({
  assignment,
  review,
  currentProposalHistoryId,
}: {
  assignment: { assignedProposalHistoryId: string | null };
  // Raw enum column infers as `string`.
  review: { state: string } | null;
  currentProposalHistoryId: string | null | undefined;
}): boolean {
  if (review?.state !== ProposalReviewState.SUBMITTED) {
    return false;
  }

  if (!assignment.assignedProposalHistoryId || !currentProposalHistoryId) {
    return false;
  }

  return assignment.assignedProposalHistoryId !== currentProposalHistoryId;
}
