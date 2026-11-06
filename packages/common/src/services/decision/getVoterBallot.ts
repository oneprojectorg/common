import { type SQL, and, asc, db, eq, sql } from '@op/db/client';
import {
  decisionsVoteProposals,
  decisionsVoteSubmissions,
} from '@op/db/schema';
import { logger } from '@op/logging';
import type { PgColumn } from 'drizzle-orm/pg-core';

import { hashBallotReceipt, isBallotSealIntact } from './ballotReceipt';

export interface VoterBallot {
  /** In rank order when `ranked`, otherwise in the order they were cast. */
  proposalIds: string[];
  ranked: boolean;
}

/**
 * A voter's ballot on one process instance. A ballot cast since votes were
 * unlinked is found only by its receipt. One cast before that is still
 * linked to its submission, so `profileId` finds it.
 */
export async function getVoterBallot({
  processInstanceId,
  profileId,
  receipt,
}: {
  processInstanceId: string;
  profileId: string;
  receipt?: string;
}): Promise<VoterBallot> {
  if (receipt) {
    const anonymous = await getBallotByReceipt({ processInstanceId, receipt });

    if (anonymous) {
      return anonymous;
    }
  }

  return getLinkedBallot({ processInstanceId, profileId });
}

/** The anonymous ballot a receipt opens on one instance, if any. */
export async function getBallotByReceipt({
  processInstanceId,
  receipt,
}: {
  processInstanceId: string;
  receipt: string;
}): Promise<VoterBallot | undefined> {
  const ballot = await db.query.decisionsVoteBallots.findFirst({
    where: {
      processInstanceId,
      receiptHash: hashBallotReceipt({ receipt, processInstanceId }),
    },
    columns: { seal: true },
    with: {
      ballotProposals: {
        columns: { proposalId: true, position: true, rank: true },
        // Postgres sorts NULLs last, so an unranked ballot keeps its cast order.
        orderBy: { rank: 'asc', position: 'asc' },
      },
    },
  });

  if (!ballot) {
    return undefined;
  }

  // The picks still open, so the voter sees what is on record; the mismatch
  // is reported, since nothing but a write to the table produces one. (A
  // proposal deleted after the vote takes its pick with it, and shows here.)
  if (
    !isBallotSealIntact({
      receipt,
      processInstanceId,
      picks: ballot.ballotProposals,
      seal: ballot.seal,
    })
  ) {
    logger.warn('Ballot no longer matches its seal', { processInstanceId });
  }

  return toVoterBallot(ballot.ballotProposals);
}

async function getLinkedBallot({
  processInstanceId,
  profileId,
}: {
  processInstanceId: string;
  profileId: string;
}): Promise<VoterBallot> {
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

  return toVoterBallot(rows);
}

function toVoterBallot(
  rows: Array<{ proposalId: string; rank: number | null }>,
): VoterBallot {
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
