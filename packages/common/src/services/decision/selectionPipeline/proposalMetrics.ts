import { type DbClient, db as defaultDb, inArray } from '@op/db/client';
import type { Proposal } from '@op/db/schema';
import { ProfileRelationshipType, profileRelationships } from '@op/db/schema';
import { count as countFn } from 'drizzle-orm';

import { listCastPicks } from '../castPicks';
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
  // Every proposal is from one instance, the one whose phase is advancing.
  const processInstanceId = phaseProposals[0]!.processInstanceId;
  const profileIds = [...new Set(phaseProposals.map((p) => p.profileId))];

  const [voteRows, relationshipCounts, mergedLikes] = await Promise.all([
    listCastPicks({ processInstanceId, proposalIds, db }),

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
    Array<{ voteData: unknown; ballotId: string }>
  >();
  for (const row of voteRows) {
    if (!proposalVotesMap.has(row.proposalId)) {
      proposalVotesMap.set(row.proposalId, []);
    }
    proposalVotesMap.get(row.proposalId)!.push({
      voteData: row.ballotData,
      ballotId: row.ballotId,
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
      likesCount:
        (likesMap.get(proposal.profileId) ?? 0) +
        (mergedLikes.get(proposal.profileId) ?? 0),
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
