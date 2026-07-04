import { sql } from '@op/db/client';
import {
  decisionsVoteProposals,
  decisionsVoteSubmissions,
  proposals,
} from '@op/db/schema';

/**
 * Correlated subquery counting ballots for a proposal within one process
 * instance. Scoping the join to `processInstanceId` ensures cross-instance
 * ballots can't inflate counts. Usable in `extras` and `orderBy` callbacks —
 * pass the (possibly aliased) table reference the callback provides.
 */
export const buildVoteCountSql = ({
  proposalsTable,
  processInstanceId,
}: {
  proposalsTable: typeof proposals;
  processInstanceId: string;
}) =>
  sql<number>`(
    SELECT COUNT(*)::int FROM ${decisionsVoteSubmissions}
    INNER JOIN ${decisionsVoteProposals}
      ON ${decisionsVoteProposals.voteSubmissionId} = ${decisionsVoteSubmissions.id}
    WHERE ${decisionsVoteProposals.proposalId} = ${proposalsTable.id}
    AND ${decisionsVoteSubmissions.processInstanceId} = ${processInstanceId}
  )`;
