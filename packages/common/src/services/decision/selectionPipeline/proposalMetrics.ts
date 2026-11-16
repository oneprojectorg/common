import { type DbClient, db as defaultDb, eq, inArray } from '@op/db/client';
import type { Proposal } from '@op/db/schema';
import {
  ProfileRelationshipType,
  decisionsVoteProposals,
  decisionsVoteSubmissions,
  profileRelationships,
} from '@op/db/schema';
import { count as countFn } from 'drizzle-orm';

import { getMergedLikeCounts } from '../proposalSupersession';
import type { VoteAggregation } from './types';

/**
 * Aggregate voting data for the given proposals.
 * Accepts an optional db so this can be called within a transaction
 * for a consistent snapshot.
 */
export async function aggregateProposalMetrics(
  phaseProposals: Proposal[],
  db: DbClient = defaultDb,
): Promise<Record<string, VoteAggregation>> {
  if (phaseProposals.length === 0) {
    return {};
  }

  const proposalIds = phaseProposals.map((p) => p.id);
  const profileIds = [...new Set(phaseProposals.map((p) => p.profileId))];

  const [voteRows, relationshipCounts, mergedLikes] = await Promise.all([
    db
      .select({
        submissionId: decisionsVoteSubmissions.id,
        voteData: decisionsVoteSubmissions.voteData,
        proposalId: decisionsVoteProposals.proposalId,
        rank: decisionsVoteProposals.rank,
      })
      .from(decisionsVoteSubmissions)
      .innerJoin(
        decisionsVoteProposals,
        eq(
          decisionsVoteProposals.voteSubmissionId,
          decisionsVoteSubmissions.id,
        ),
      )
      .where(inArray(decisionsVoteProposals.proposalId, proposalIds)),

    db
      .select({
        targetProfileId: profileRelationships.targetProfileId,
        relationshipType: profileRelationships.relationshipType,
        count: countFn(),
      })
      .from(profileRelationships)
      .where(inArray(profileRelationships.targetProfileId, profileIds))
      .groupBy(
        profileRelationships.targetProfileId,
        profileRelationships.relationshipType,
      ),

    getMergedLikeCounts({ targetProfileIds: profileIds, db }),
  ]);

  const likesMap = new Map<string, number>();
  const followsMap = new Map<string, number>();

  for (const row of relationshipCounts) {
    if (row.relationshipType === ProfileRelationshipType.LIKES) {
      likesMap.set(row.targetProfileId, Number(row.count));
    } else if (row.relationshipType === ProfileRelationshipType.FOLLOWING) {
      followsMap.set(row.targetProfileId, Number(row.count));
    }
  }

  // Group vote rows by proposal
  const proposalVotesMap = new Map<
    string,
    Array<{ voteData: unknown; submissionId: string; rank: number | null }>
  >();
  for (const row of voteRows) {
    if (!proposalVotesMap.has(row.proposalId)) {
      proposalVotesMap.set(row.proposalId, []);
    }
    proposalVotesMap.get(row.proposalId)!.push({
      voteData: row.voteData,
      submissionId: row.submissionId,
      rank: row.rank,
    });
  }

  // Build aggregation per proposal
  const voteDataMap: Record<string, VoteAggregation> = {};

  for (const proposal of phaseProposals) {
    const votes = proposalVotesMap.get(proposal.id) ?? [];

    voteDataMap[proposal.id] = {
      proposalId: proposal.id,
      likesCount:
        (likesMap.get(proposal.profileId) ?? 0) +
        (mergedLikes.get(proposal.profileId) ?? 0),
      followsCount: followsMap.get(proposal.profileId) ?? 0,
      ...summarizeVotes(votes),
      votes: votes.map((v) => v.voteData),
    };
  }

  return voteDataMap;
}

type VoteSummary = Pick<
  VoteAggregation,
  | 'voteCount'
  | 'approvalCount'
  | 'rejectionCount'
  | 'abstainCount'
  | 'approvalRate'
  | 'rankCounts'
>;

function summarizeVotes(
  votes: Array<{ voteData: unknown; rank: number | null }>,
): VoteSummary {
  let approvalCount = 0;
  let rejectionCount = 0;
  let abstainCount = 0;
  const rankCounts: { [rank: number]: number } = {};

  for (const vote of votes) {
    if (vote.rank != null) {
      rankCounts[vote.rank] = (rankCounts[vote.rank] ?? 0) + 1;
    }

    const voteData = vote.voteData as Record<string, unknown> | null;
    if (voteData?.approved === true || voteData?.vote === 'approve') {
      approvalCount++;
    } else if (voteData?.approved === false || voteData?.vote === 'reject') {
      rejectionCount++;
    } else if (voteData?.vote === 'abstain') {
      abstainCount++;
    }
  }

  const voteCount = votes.length;

  return {
    voteCount,
    approvalCount,
    rejectionCount,
    abstainCount,
    approvalRate: voteCount > 0 ? approvalCount / voteCount : 0,
    rankCounts,
  };
}
