import { db, eq, inArray } from '@op/db/client';
import type { DbClient } from '@op/db/client';
import type { Proposal } from '@op/db/schema';
import {
  ProfileRelationshipType,
  decisionsVoteProposals,
  decisionsVoteSubmissions,
  profileRelationships,
} from '@op/db/schema';

import type { VoteAggregation } from './types';

/**
 * Aggregate voting data for the given proposals.
 * Accepts an optional dbClient so this can be called within a transaction
 * for a consistent snapshot.
 */
export async function aggregateVoteData(
  processInstanceId: string,
  phaseProposals: Proposal[],
  dbClient: DbClient = db,
): Promise<Record<string, VoteAggregation>> {
  if (phaseProposals.length === 0) {
    return {};
  }

  const proposalIds = phaseProposals.map((p) => p.id);
  const profileIds = [...new Set(phaseProposals.map((p) => p.profileId))];

  // Fetch votes and profile relationships in parallel
  const [voteRows, relationships] = await Promise.all([
    dbClient
      .select({
        submissionId: decisionsVoteSubmissions.id,
        voteData: decisionsVoteSubmissions.voteData,
        proposalId: decisionsVoteProposals.proposalId,
      })
      .from(decisionsVoteSubmissions)
      .innerJoin(
        decisionsVoteProposals,
        eq(
          decisionsVoteProposals.voteSubmissionId,
          decisionsVoteSubmissions.id,
        ),
      )
      .where(eq(decisionsVoteSubmissions.processInstanceId, processInstanceId)),

    dbClient
      .select()
      .from(profileRelationships)
      .where(inArray(profileRelationships.targetProfileId, profileIds)),
  ]);

  // Count likes and follows by profile ID
  const likesMap = new Map<string, number>();
  const followsMap = new Map<string, number>();

  for (const relationship of relationships) {
    const profileId = relationship.targetProfileId;
    if (relationship.relationshipType === ProfileRelationshipType.LIKES) {
      likesMap.set(profileId, (likesMap.get(profileId) ?? 0) + 1);
    } else if (
      relationship.relationshipType === ProfileRelationshipType.FOLLOWING
    ) {
      followsMap.set(profileId, (followsMap.get(profileId) ?? 0) + 1);
    }
  }

  // Group vote rows by proposal, scoped to the current-phase proposals
  const proposalIdSet = new Set(proposalIds);
  const proposalVotesMap = new Map<
    string,
    Array<{ voteData: unknown; submissionId: string }>
  >();
  for (const row of voteRows) {
    if (!proposalIdSet.has(row.proposalId)) {
      continue;
    }
    if (!proposalVotesMap.has(row.proposalId)) {
      proposalVotesMap.set(row.proposalId, []);
    }
    proposalVotesMap.get(row.proposalId)!.push({
      voteData: row.voteData,
      submissionId: row.submissionId,
    });
  }

  // Build aggregation per proposal
  const voteDataMap: Record<string, VoteAggregation> = {};

  for (const proposal of phaseProposals) {
    const votes = proposalVotesMap.get(proposal.id) ?? [];
    const voteCount = votes.length;

    let approvalCount = 0;
    let rejectionCount = 0;
    let abstainCount = 0;

    for (const vote of votes) {
      const voteData = vote.voteData as Record<string, unknown> | null;
      if (voteData?.approved === true || voteData?.vote === 'approve') {
        approvalCount++;
      } else if (voteData?.approved === false || voteData?.vote === 'reject') {
        rejectionCount++;
      } else if (voteData?.vote === 'abstain') {
        abstainCount++;
      }
    }

    voteDataMap[proposal.id] = {
      proposalId: proposal.id,
      likesCount: likesMap.get(proposal.profileId) ?? 0,
      followsCount: followsMap.get(proposal.profileId) ?? 0,
      voteCount,
      approvalCount,
      rejectionCount,
      abstainCount,
      approvalRate: voteCount > 0 ? approvalCount / voteCount : 0,
      votes: votes.map((v) => v.voteData),
    };
  }

  return voteDataMap;
}
