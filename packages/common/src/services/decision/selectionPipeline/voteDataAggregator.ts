import { db, eq, inArray } from '@op/db/client';
import {
  ProfileRelationshipType,
  decisionsVoteSubmissions,
  profileRelationships,
  proposals,
} from '@op/db/schema';

import type { VoteAggregation } from './types';

/**
 * Aggregate voting data for all proposals in a process instance
 */
export async function aggregateVoteData(
  processInstanceId: string,
): Promise<Record<string, VoteAggregation>> {
  try {
    // Get all proposals for this process instance
    const processProposals = await db.query.proposals.findMany({
      where: eq(proposals.processInstanceId, processInstanceId),
    });

    // Build a map of proposal ID to profile ID for relationship lookups
    const proposalToProfileMap = new Map<string, string>();
    for (const proposal of processProposals) {
      proposalToProfileMap.set(proposal.id, proposal.profileId);
    }

    // Get all vote submissions for proposals in this process instance
    const voteSubmissions = await db.query.decisionsVoteSubmissions.findMany({
      where: eq(decisionsVoteSubmissions.processInstanceId, processInstanceId),
      with: {
        voteProposals: true,
      },
    });

    // Get all likes and follows for the proposals
    const profileIds = Array.from(proposalToProfileMap.values());
    const relationships =
      profileIds.length > 0
        ? await db
            .select()
            .from(profileRelationships)
            .where(inArray(profileRelationships.targetProfileId, profileIds))
        : [];

    // Count likes and follows by profile ID
    const likesMap = new Map<string, number>();
    const followsMap = new Map<string, number>();

    for (const relationship of relationships) {
      const profileId = relationship.targetProfileId;
      if (!profileIds.includes(profileId)) {
        continue;
      }

      if (relationship.relationshipType === ProfileRelationshipType.LIKES) {
        likesMap.set(profileId, (likesMap.get(profileId) || 0) + 1);
      } else if (
        relationship.relationshipType === ProfileRelationshipType.FOLLOWING
      ) {
        followsMap.set(profileId, (followsMap.get(profileId) || 0) + 1);
      }
    }

    // Build a map of proposal ID to vote aggregation
    const voteDataMap: Record<string, VoteAggregation> = {};

    // Track votes by proposal
    const proposalVotesMap = new Map<
      string,
      Array<{ voteData: any; submissionId: string }>
    >();

    for (const submission of voteSubmissions) {
      if (!submission.voteProposals || submission.voteProposals.length === 0) {
        continue;
      }

      for (const voteProposal of submission.voteProposals) {
        if (!proposalVotesMap.has(voteProposal.proposalId)) {
          proposalVotesMap.set(voteProposal.proposalId, []);
        }

        proposalVotesMap.get(voteProposal.proposalId)?.push({
          voteData: voteProposal.voteData,
          submissionId: submission.id,
        });
      }
    }

    // Initialize vote data for all proposals
    for (const proposal of processProposals) {
      const profileId = proposal.profileId;
      const votes = proposalVotesMap.get(proposal.id) || [];
      const voteCount = votes.length;

      // Count approvals, rejections, and abstentions
      let approvalCount = 0;
      let rejectionCount = 0;
      let abstainCount = 0;

      for (const vote of votes) {
        const voteData = vote.voteData as any;

        if (voteData?.approved === true || voteData?.vote === 'approve') {
          approvalCount++;
        } else if (
          voteData?.approved === false ||
          voteData?.vote === 'reject'
        ) {
          rejectionCount++;
        } else if (voteData?.vote === 'abstain') {
          abstainCount++;
        }
      }

      const approvalRate = voteCount > 0 ? approvalCount / voteCount : 0;

      voteDataMap[proposal.id] = {
        proposalId: proposal.id,
        likesCount: likesMap.get(profileId) || 0,
        followsCount: followsMap.get(profileId) || 0,
        voteCount,
        approvalCount,
        rejectionCount,
        abstainCount,
        approvalRate,
        votes: votes.map((v) => v.voteData),
      };
    }

    return voteDataMap;
  } catch (error) {
    console.error('Error aggregating vote data:', error);
    return {};
  }
}
