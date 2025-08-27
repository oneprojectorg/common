import { and, asc, db, desc, eq, ilike, inArray, sql } from '@op/db/client';
import {
  ProfileRelationshipType,
  profileRelationships,
  proposalCategories,
  proposals,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';
import { count as countFn } from 'drizzle-orm';

import { UnauthorizedError } from '../../utils';
import {
  getCurrentOrgId,
  getCurrentProfileId,
  getOrgAccessUser,
} from '../access';

export interface ListProposalsInput {
  processInstanceId: string;
  submittedByProfileId?: string;
  status?: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected';
  search?: string;
  categoryId?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'status';
  dir?: 'asc' | 'desc';
  authUserId: string;
}

// Shared function to build WHERE conditions for both count and data queries
const buildWhereConditions = (input: ListProposalsInput) => {
  const { processInstanceId, submittedByProfileId, status, search } = input;

  const conditions = [];

  conditions.push(eq(proposals.processInstanceId, processInstanceId));

  if (submittedByProfileId) {
    conditions.push(eq(proposals.submittedByProfileId, submittedByProfileId));
  }

  if (status) {
    conditions.push(eq(proposals.status, status));
  }

  if (search) {
    // Search in proposal data (JSONB) - convert to text for searching
    conditions.push(ilike(sql`${proposals.proposalData}::text`, `%${search}%`));
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
};

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

  const orgUserId = await getCurrentOrgId({ authUserId: input.authUserId });
  const orgUser = await getOrgAccessUser({
    user,
    organizationId: orgUserId,
  });

  assertAccess({ decisions: permission.READ }, orgUser?.roles ?? []);

  try {
    const {
      limit = 20,
      offset = 0,
      orderBy = 'createdAt',
      dir = 'desc',
    } = input;

    // Build shared WHERE clause using the extracted function
    const baseWhereClause = buildWhereConditions(input);

    // Handle category filtering separately to avoid table reference issues
    const { categoryId } = input;
    let whereClause = baseWhereClause;
    let categoryProposalIds: string[] = [];

    if (categoryId) {
      // First get proposal IDs that belong to the category
      const proposalIdsInCategory = await db
        .select({ proposalId: proposalCategories.proposalId })
        .from(proposalCategories)
        .where(eq(proposalCategories.taxonomyTermId, categoryId));

      categoryProposalIds = proposalIdsInCategory.map((p) => p.proposalId);

      if (categoryProposalIds.length === 0) {
        // No proposals in this category, return empty result early
        return {
          proposals: [],
          total: 0,
          hasMore: false,
        };
      }

      // Add category filter to WHERE clause
      const categoryFilter = inArray(proposals.id, categoryProposalIds);
      whereClause = baseWhereClause
        ? and(baseWhereClause, categoryFilter)
        : categoryFilter;
    }

    // Get count using Drizzle's count function instead of raw SQL
    const countResult = await db
      .select({ count: countFn() })
      .from(proposals)
      .where(whereClause);

    const count = countResult[0]?.count || 0;

    // Get proposals with optimized ordering
    const orderColumn = proposals[orderBy] ?? proposals.createdAt;

    const orderFn = dir === 'asc' ? asc : desc;

    const proposalList = await db.query.proposals.findMany({
      where: whereClause,
      with: {
        processInstance: {
          with: {
            process: true,
          },
        },
        submittedBy: {
          with: {
            avatarImage: true,
          },
        },
        profile: true,
        decisions: true,
      },
      limit,
      offset,
      orderBy: orderFn(orderColumn),
    });

    // Get relationship data for all proposal profiles using optimized Drizzle queries
    const proposalIds = proposalList
      .map((p: any) => p.profileId)
      .filter((id: any): id is string => Boolean(id));

    let relationshipData = new Map<
      string,
      {
        likesCount: number;
        followersCount: number;
        isLikedByUser: boolean;
        isFollowedByUser: boolean;
      }
    >();

    if (proposalIds.length > 0) {
      const currentProfileId = await getCurrentProfileId(input.authUserId);

      // Optimized: Get both relationship counts and user relationships in parallel
      const [relationshipCounts, userRelationships] = await Promise.all([
        // Get relationship counts for all profile IDs (likes and follows)
        db
          .select({
            targetProfileId: profileRelationships.targetProfileId,
            relationshipType: profileRelationships.relationshipType,
            count: countFn(),
          })
          .from(profileRelationships)
          .where(inArray(profileRelationships.targetProfileId, proposalIds))
          .groupBy(
            profileRelationships.targetProfileId,
            profileRelationships.relationshipType,
          ),

        // Get user's relationships to these profiles
        db
          .select({
            targetProfileId: profileRelationships.targetProfileId,
            relationshipType: profileRelationships.relationshipType,
          })
          .from(profileRelationships)
          .where(
            and(
              eq(profileRelationships.sourceProfileId, currentProfileId),
              inArray(profileRelationships.targetProfileId, proposalIds),
            ),
          ),
      ]);

      // Build the relationship data map efficiently
      proposalIds.forEach((profileId: string) => {
        const likesCount =
          relationshipCounts.find(
            (rc) =>
              rc.targetProfileId === profileId &&
              rc.relationshipType === ProfileRelationshipType.LIKES,
          )?.count || 0;

        const followersCount =
          relationshipCounts.find(
            (rc) =>
              rc.targetProfileId === profileId &&
              rc.relationshipType === ProfileRelationshipType.FOLLOWING,
          )?.count || 0;

        const isLikedByUser = userRelationships.some(
          (ur) =>
            ur.targetProfileId === profileId &&
            ur.relationshipType === ProfileRelationshipType.LIKES,
        );

        const isFollowedByUser = userRelationships.some(
          (ur) =>
            ur.targetProfileId === profileId &&
            ur.relationshipType === ProfileRelationshipType.FOLLOWING,
        );

        relationshipData.set(profileId, {
          likesCount: Number(likesCount),
          followersCount: Number(followersCount),
          isLikedByUser,
          isFollowedByUser,
        });
      });
    }

    // Transform the results to match the expected structure and add decision counts, likes count, and user relationship status
    // TODO: improve this with more streamlined types
    const proposalsWithCounts = proposalList.map((proposal: any) => {
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

      const relationshipInfo = proposal.profileId
        ? relationshipData.get(proposal.profileId)
        : null;

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
        likesCount: relationshipInfo?.likesCount || 0,
        followersCount: relationshipInfo?.followersCount || 0,
        isLikedByUser: relationshipInfo?.isLikedByUser || false,
        isFollowedByUser: relationshipInfo?.isFollowedByUser || false,
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
