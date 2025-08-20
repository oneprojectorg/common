import { and, asc, db, desc, eq, sql, inArray } from '@op/db/client';
import { profileRelationships, proposals, users, ProfileRelationshipType } from '@op/db/schema';
import { User } from '@op/supabase/lib';

import { UnauthorizedError } from '../../utils';

export interface ListProposalsInput {
  processInstanceId?: string;
  submittedByProfileId?: string;
  status?: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected';
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'status';
  orderDirection?: 'asc' | 'desc';
}

export const listProposals = async ({
  input,
  user,
}: {
  input: ListProposalsInput;
  user: User;
}) => {
  if (!user) {
    throw new UnauthorizedError('User must be authenticated');
  }

  try {
    // Get the database user record to access currentProfileId
    const dbUser = await db.query.users.findFirst({
      where: eq(users.authUserId, user.id),
    });

    if (!dbUser || !dbUser.currentProfileId) {
      throw new UnauthorizedError('User must have an active profile');
    }

    const {
      processInstanceId,
      submittedByProfileId,
      status,
      search,
      limit = 20,
      offset = 0,
      orderBy = 'createdAt',
      orderDirection = 'desc',
    } = input;

    // Build filter conditions
    const conditions = [];

    if (processInstanceId) {
      conditions.push(eq(proposals.processInstanceId, processInstanceId));
    }

    if (submittedByProfileId) {
      conditions.push(eq(proposals.submittedByProfileId, submittedByProfileId));
    }

    if (status) {
      conditions.push(eq(proposals.status, status));
    }

    if (search) {
      // Search in proposal data (JSONB)
      conditions.push(
        sql`${proposals.proposalData}::text ILIKE ${`%${search}%`}`,
      );
    }

    // Combine conditions
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count for pagination
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(proposals)
      .where(whereClause);

    const count = countResult[0]?.count || 0;

    // Get proposals using Drizzle's declarative relational query style
    const orderColumn =
      orderBy === 'createdAt'
        ? proposals.createdAt
        : orderBy === 'updatedAt'
          ? proposals.updatedAt
          : orderBy === 'status'
            ? proposals.status
            : proposals.createdAt;

    const orderFn = orderDirection === 'asc' ? asc : desc;

    const proposalList = await db.query.proposals.findMany({
      where: whereClause,
      with: {
        processInstance: {
          with: {
            process: true,
          },
        },
        submittedBy: true,
        profile: true,
        decisions: true, // Include decisions to calculate count
      },
      limit,
      offset,
      orderBy: orderFn(orderColumn),
    });

    // Get likes count for each proposal and user relationship status
    const proposalIds = proposalList.map(p => p.profileId).filter(Boolean);
    
    let likesCountMap = new Map();
    let userRelationshipMap = new Map();

    if (proposalIds.length > 0) {
      // Get likes counts for all proposals
      const likesCountQuery = await db
        .select({
          targetProfileId: profileRelationships.targetProfileId,
          count: sql<number>`count(*)`,
        })
        .from(profileRelationships)
        .where(
          and(
            inArray(profileRelationships.targetProfileId, proposalIds),
            eq(profileRelationships.relationshipType, ProfileRelationshipType.LIKES)
          )
        )
        .groupBy(profileRelationships.targetProfileId);

      likesCountMap = new Map(likesCountQuery.map(item => [item.targetProfileId, Number(item.count)]));

      // Get current user's relationships to these proposals
      const userRelationships = await db
        .select({
          targetProfileId: profileRelationships.targetProfileId,
          relationshipType: profileRelationships.relationshipType,
        })
        .from(profileRelationships)
        .where(
          and(
            eq(profileRelationships.sourceProfileId, dbUser.currentProfileId),
            inArray(profileRelationships.targetProfileId, proposalIds)
          )
        );

      userRelationships.forEach(rel => {
        if (!userRelationshipMap.has(rel.targetProfileId)) {
          userRelationshipMap.set(rel.targetProfileId, { isLiked: false, isFollowed: false });
        }
        if (rel.relationshipType === ProfileRelationshipType.LIKES) {
          userRelationshipMap.get(rel.targetProfileId).isLiked = true;
        }
        if (rel.relationshipType === ProfileRelationshipType.FOLLOWING) {
          userRelationshipMap.get(rel.targetProfileId).isFollowed = true;
        }
      });
    }

    // Transform the results to match the expected structure and add decision counts, likes count, and user relationship status
    // TODO: improve this with more streamlined types
    const proposalsWithCounts = proposalList.map((proposal) => {
      const processInstance = Array.isArray(proposal.processInstance)
        ? proposal.processInstance[0]
        : proposal.processInstance;
      const submittedBy = Array.isArray(proposal.submittedBy)
        ? proposal.submittedBy[0]
        : proposal.submittedBy;
      const profile = Array.isArray(proposal.profile)
        ? proposal.profile[0]
        : proposal.profile;
      const decisions = Array.isArray(proposal.decisions)
        ? proposal.decisions
        : [];

      const likesCount = proposal.profileId ? (likesCountMap.get(proposal.profileId) || 0) : 0;
      const userRelationship = proposal.profileId ? userRelationshipMap.get(proposal.profileId) : null;

      return {
        id: proposal.id,
        proposalData: proposal.proposalData,
        status: proposal.status,
        createdAt: proposal.createdAt,
        updatedAt: proposal.updatedAt,
        profileId: proposal.profileId,
        processInstance: processInstance
          ? {
              id: processInstance.id,
              name: processInstance.name,
              description: processInstance.description,
              instanceData: processInstance.instanceData,
              currentStateId: processInstance.currentStateId,
              status: processInstance.status,
              createdAt: processInstance.createdAt,
              updatedAt: processInstance.updatedAt,
              process: processInstance.process
                ? {
                    id: processInstance.process.id,
                    name: processInstance.process.name,
                    description: processInstance.process.description,
                    createdAt: processInstance.process.createdAt,
                    updatedAt: processInstance.process.updatedAt,
                    processSchema: processInstance.process.processSchema,
                  }
                : undefined,
            }
          : undefined,
        submittedBy: submittedBy,
        profile: profile,
        decisionCount: decisions.length,
        likesCount,
        isLikedByUser: userRelationship?.isLiked || false,
        isFollowedByUser: userRelationship?.isFollowed || false,
      };
    });

    return {
      proposals: proposalsWithCounts,
      total: Number(count),
      hasMore: offset + limit < Number(count),
    };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    console.error('Error listing proposals:', error);
    throw new Error('Failed to list proposals');
  }
};
