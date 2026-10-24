import { type SQL, and, asc, db, eq, sql } from '@op/db/client';
import {
  decisionsVoteProposals,
  decisionsVoteSubmissions,
} from '@op/db/schema';
import type { PgColumn } from 'drizzle-orm/pg-core';

export interface VoterBallot {
  /** In rank order when `ranked`, otherwise in the order they were cast. */
  proposalIds: string[];
  ranked: boolean;
}

/** A voter's ballot on one process instance. */
export async function getVoterBallot({
  processInstanceId,
  profileId,
}: {
  processInstanceId: string;
  profileId: string;
}): Promise<VoterBallot> {
  // Postgres sorts NULLs last, so an unranked ballot keeps its cast order.
  const rows = await db
    .select({
      proposalId: decisionsVoteProposals.proposalId,
      rank: decisionsVoteProposals.rank,
    })
    .from(decisionsVoteSubmissions)
    .innerJoin(
      decisionsVoteProposals,
      eq(decisionsVoteSubmissions.id, decisionsVoteProposals.voteSubmissionId),
    )
    .where(
      and(
        eq(decisionsVoteSubmissions.processInstanceId, processInstanceId),
        eq(decisionsVoteSubmissions.submittedByProfileId, profileId),
      ),
    )
    .orderBy(
      asc(decisionsVoteProposals.rank),
      asc(decisionsVoteProposals.createdAt),
    );

  return {
    proposalIds: rows.map((row) => row.proposalId),
    ranked: rows.some((row) => row.rank != null),
  };
}

/** Sorts proposals into the ballot's rank order, given its ranked ids. */
export function ballotRankPosition({
  rankedProposalIds,
  proposalId,
}: {
  rankedProposalIds: string[];
  proposalId: PgColumn;
}): SQL {
  const ids = sql.join(
    rankedProposalIds.map((id) => sql`${id}`),
    sql`, `,
  );

  return sql`array_position(ARRAY[${ids}]::uuid[], ${proposalId})`;
}
