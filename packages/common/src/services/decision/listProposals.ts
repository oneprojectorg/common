import { and, asc, db, desc, eq, ilike, inArray, or, sql } from '@op/db/client';
import {
  ProfileRelationshipType,
  ProposalStatus,
  Visibility,
  organizations,
  posts,
  postsToProfiles,
  processInstances,
  profileRelationships,
  proposalCategories,
  proposals,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { assertAccess, checkPermission, permission } from 'access-zones';
import { count as countFn } from 'drizzle-orm';

import { UnauthorizedError } from '../../utils';
import { getCurrentProfileId, getOrgAccessUser } from '../access';

export interface ListProposalsInput {
  processInstanceId: string;
  submittedByProfileId?: string;
  status?: ProposalStatus;
  search?: string;
  categoryId?: string;
  proposalIds?: string[];
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'status';
  dir?: 'asc' | 'desc';
  authUserId: string;
  skipAccessCheck?: boolean; // For trusted contexts like background jobs
}

// Shared function to build WHERE conditions for both count and data queries
const buildWhereConditions = (input: ListProposalsInput) => {
  const {
    processInstanceId,
    submittedByProfileId,
    status,
    search,
    proposalIds,
  } = input;

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

  if (proposalIds && proposalIds.length > 0) {
    conditions.push(inArray(proposals.id, proposalIds));
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
  const { processInstanceId, skipAccessCheck = false } = input;

  // Skip authentication check if this is a trusted context (e.g., background job)
  if (!skipAccessCheck && !user) {
    throw new UnauthorizedError('User must be authenticated');
  }

  // join the process table to the org table via ownerId to get the org id
  const instanceOrg = await db
    .select({
      id: organizations.id,
      currentStateId: processInstances.currentStateId,
    })
    .from(organizations)
    .leftJoin(
      processInstances,
      eq(organizations.profileId, processInstances.ownerProfileId),
    )
    .where(eq(processInstances.id, processInstanceId))
    .limit(1);

  if (!instanceOrg[0]) {
    throw new UnauthorizedError('User does not have access to this process');
  }

  let canManageProposals = false;
  let orgUser: Awaited<ReturnType<typeof getOrgAccessUser>> = undefined;

  // Only perform access checks if not skipped
  if (!skipAccessCheck) {
    // ASSERT VIEW ACCESS ON ORGUSER
    orgUser = await getOrgAccessUser({
      user,
      organizationId: instanceOrg[0].id,
    });

    assertAccess({ decisions: permission.READ }, orgUser?.roles ?? []);

    // Check if user can manage proposals (approve/reject)
    canManageProposals = checkPermission(
      { decisions: permission.ADMIN },
      orgUser?.roles ?? [],
    );
  }

  // Get current user's profile ID early for hidden filter and later for editable checks
  const currentProfileId = await getCurrentProfileId(input.authUserId);

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
          canManageProposals,
        };
      }

      // Add category filter to WHERE clause
      const categoryFilter = inArray(proposals.id, categoryProposalIds);
      whereClause = baseWhereClause
        ? and(baseWhereClause, categoryFilter)
        : categoryFilter;
    }

    // Filter out hidden proposals unless user can manage proposals (admin) or is the owner
    if (!canManageProposals) {
      const visibilityFilter = or(
        eq(proposals.visibility, Visibility.VISIBLE),
        eq(proposals.submittedByProfileId, currentProfileId),
      );
      whereClause = whereClause
        ? and(whereClause, visibilityFilter)
        : visibilityFilter;
    }

    // Get proposals with optimized ordering
    const orderColumn = proposals[orderBy] ?? proposals.createdAt;

    const orderFn = dir === 'asc' ? asc : desc;

    const [proposalList, countResult] = await Promise.all([
      db.query.proposals.findMany({
        where: whereClause,
        with: {
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
      }),
      // Get count using Drizzle's count function instead of raw SQL
      db.select({ count: countFn() }).from(proposals).where(whereClause),
    ]);

    const count = countResult[0]?.count || 0;

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
        commentsCount: number;
      }
    >();

    if (proposalIds.length > 0) {
      // Optimized: Get relationship counts, user relationships, and comment counts in parallel
      const [relationshipCounts, userRelationships, commentCounts] =
        await Promise.all([
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

          // Get comment counts for all profile IDs
          db
            .select({
              profileId: postsToProfiles.profileId,
              count: countFn(),
            })
            .from(posts)
            .innerJoin(postsToProfiles, eq(posts.id, postsToProfiles.postId))
            .where(inArray(postsToProfiles.profileId, proposalIds))
            .groupBy(postsToProfiles.profileId),
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

        const commentsCount =
          commentCounts.find((cc) => cc.profileId === profileId)?.count || 0;

        relationshipData.set(profileId, {
          likesCount: Number(likesCount),
          followersCount: Number(followersCount),
          isLikedByUser,
          isFollowedByUser,
          commentsCount: Number(commentsCount),
        });
      });
    }

    // Transform the results to match the expected structure and add decision counts, likes count, and user relationship status
    // TODO: improve this with more streamlined types
    const proposalsWithCounts = proposalList.map((proposal: any) => {
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

      // Check if proposal is editable by current user
      const isOwner = proposal.submittedByProfileId === currentProfileId;
      const hasAdminPermission = checkPermission(
        { decisions: permission.ADMIN },
        orgUser?.roles ?? [],
      );
      const isEditable = isOwner || hasAdminPermission;

      return {
        id: proposal.id,
        proposalData: proposal.proposalData,
        status: proposal.status,
        visibility: proposal.visibility,
        createdAt: proposal.createdAt,
        updatedAt: proposal.updatedAt,
        profileId: proposal.profileId,
        submittedBy: submittedBy,
        profile: profile,
        decisionCount: decisions.length,
        likesCount: relationshipInfo?.likesCount || 0,
        followersCount: relationshipInfo?.followersCount || 0,
        isLikedByUser: relationshipInfo?.isLikedByUser || false,
        isFollowedByUser: relationshipInfo?.isFollowedByUser || false,
        commentsCount: relationshipInfo?.commentsCount || 0,
        isEditable,
      };
    });

    return {
      proposals: proposalsWithCounts,
      total: Number(count),
      hasMore: offset + limit < Number(count),
      canManageProposals,
    };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    console.error('Error listing proposals:', error);
    throw new Error('Failed to list proposals');
  }
};
