import { and, db, eq } from '@op/db/client';
import {
  decisionsVoteProposals,
  decisionsVoteSubmissions,
} from '@op/db/schema';

/**
 * Proposal ids on a voter's ballot for an instance — the ID set behind the
 * "My ballot" filter on both the phase-scoped and phase-agnostic proposal
 * lists.
 *
 * Ballots are private, so callers are responsible for asserting that the
 * requester may read `voterProfileId`'s ballot before calling.
 */
export const getVotedProposalIds = async ({
  processInstanceId,
  voterProfileId,
}: {
  processInstanceId: string;
  voterProfileId: string;
}): Promise<string[]> => {
  const votedRows = await db
    .select({ proposalId: decisionsVoteProposals.proposalId })
    .from(decisionsVoteSubmissions)
    .innerJoin(
      decisionsVoteProposals,
      eq(decisionsVoteSubmissions.id, decisionsVoteProposals.voteSubmissionId),
    )
    .where(
      and(
        eq(decisionsVoteSubmissions.processInstanceId, processInstanceId),
        eq(decisionsVoteSubmissions.submittedByProfileId, voterProfileId),
      ),
    );

  return votedRows.map((row) => row.proposalId);
};
