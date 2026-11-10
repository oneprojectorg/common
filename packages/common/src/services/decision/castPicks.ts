import { type DbClient, type SQL, db as defaultDb, sql } from '@op/db/client';
import {
  decisionsVoteBallotProposals,
  decisionsVoteBallots,
  decisionsVoteProposals,
  decisionsVoteSubmissions,
} from '@op/db/schema';

/**
 * Every pick cast on an instance, one row per (ballot, proposal): the picks
 * on anonymous ballots plus those on legacy ballots still linked to their
 * submission. A new submission writes no legacy picks, so nothing is counted
 * twice. `ballot_data` is the ballot's JSON (`vote_data` on a legacy one).
 */
export function castPicks(processInstanceId: string): SQL {
  return sql`(
    SELECT ${decisionsVoteBallotProposals.proposalId} AS proposal_id,
           ${decisionsVoteBallots.id} AS ballot_id,
           ${decisionsVoteBallots.ballotData} AS ballot_data
      FROM ${decisionsVoteBallots}
      INNER JOIN ${decisionsVoteBallotProposals}
        ON ${decisionsVoteBallotProposals.ballotId} = ${decisionsVoteBallots.id}
     WHERE ${decisionsVoteBallots.processInstanceId} = ${processInstanceId}
    UNION ALL
    SELECT ${decisionsVoteProposals.proposalId},
           ${decisionsVoteSubmissions.id},
           ${decisionsVoteSubmissions.voteData}
      FROM ${decisionsVoteSubmissions}
      INNER JOIN ${decisionsVoteProposals}
        ON ${decisionsVoteProposals.voteSubmissionId} = ${decisionsVoteSubmissions.id}
     WHERE ${decisionsVoteSubmissions.processInstanceId} = ${processInstanceId}
  )`;
}

/** Votes cast for each of `proposalIds`; a proposal with none is absent. */
export async function countCastVotes({
  processInstanceId,
  proposalIds,
  db = defaultDb,
}: {
  processInstanceId: string;
  proposalIds: string[];
  db?: DbClient;
}): Promise<Map<string, number>> {
  if (proposalIds.length === 0) {
    return new Map();
  }

  // Raw SQL: the picks are a UNION, which the query builder can't select from.
  const rows = await db.execute<{ proposal_id: string; count: number }>(sql`
    SELECT picks.proposal_id, COUNT(*)::int AS count
      FROM ${castPicks(processInstanceId)} AS picks
     WHERE picks.proposal_id IN (${idList(proposalIds)})
     GROUP BY picks.proposal_id
  `);

  return new Map(rows.map((row) => [row.proposal_id, Number(row.count)]));
}

/** Each pick cast for one of `proposalIds`, with its ballot's JSON. */
export async function listCastPicks({
  processInstanceId,
  proposalIds,
  db = defaultDb,
}: {
  processInstanceId: string;
  proposalIds: string[];
  db?: DbClient;
}): Promise<
  Array<{ proposalId: string; ballotId: string; ballotData: unknown }>
> {
  if (proposalIds.length === 0) {
    return [];
  }

  // Raw SQL: the picks are a UNION, which the query builder can't select from.
  const rows = await db.execute<{
    proposal_id: string;
    ballot_id: string;
    ballot_data: unknown;
  }>(sql`
    SELECT picks.proposal_id, picks.ballot_id, picks.ballot_data
      FROM ${castPicks(processInstanceId)} AS picks
     WHERE picks.proposal_id IN (${idList(proposalIds)})
  `);

  return rows.map((row) => ({
    proposalId: row.proposal_id,
    ballotId: row.ballot_id,
    ballotData: row.ballot_data,
  }));
}

function idList(ids: string[]): SQL {
  return sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `,
  );
}
