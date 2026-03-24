import {
  and,
  asc,
  db,
  desc,
  eq,
  ilike,
  inArray,
  ne,
  or,
  sql,
} from '@op/db/client';
import {
  ProfileRelationshipType,
  ProposalStatus,
  Visibility,
  posts,
  postsToProfiles,
  processInstances,
  profileRelationships,
  profileUsers,
  proposalCategories,
  proposals,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';
import { count as countFn } from 'drizzle-orm';

import { UnauthorizedError } from '../../utils';
import {
  assertInstanceProfileAccess,
  getCurrentProfileId,
  getProfileAccessUser,
} from '../access';
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import { getProposalIdsForPhase } from './getProposalsForPhase';
import { parseProposalData } from './proposalDataSchema';
import { resolveProposalTemplate } from './resolveProposalTemplate';

export interface ListProposalsInput {
  processInstanceId: string;
  submittedByProfileId?: string;
  status?: ProposalStatus;
  search?: string;
  categoryId?: string;
  /** Scope results to a specific phase. Defaults to the current phase when omitted. */
  phaseId?: string;
  /**
   * Internal override: skip phase resolution and use this exact set of IDs.
   * Not exposed on the tRPC schema — use phaseId for public phase filtering.
   */
  proposalIds?: string[];
  phase?: 'results';
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'status';
  dir?: 'asc' | 'desc';
  authUserId: string;
  skipAccessCheck?: boolean; // For trusted contexts like background jobs
}

// Shared function to build WHERE conditions for both count and data queries
const buildWhereConditions = (
  input: ListProposalsInput,
  phaseProposalIds: string[],
) => {
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

  if (phaseProposalIds.length > 0) {
    conditions.push(inArray(proposals.id, phaseProposalIds));
  } else {
    // No proposals in this phase — return empty result set
    conditions.push(sql`false`);
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

  const phaseProposalIds =
    input.proposalIds ??
    (await getProposalIdsForPhase({
      instanceId: processInstanceId,
      phaseId: input.phaseId,
    }));

  // Skip authentication check if this is a trusted context (e.g., background job)
  if (!skipAccessCheck && !user) {
    throw new UnauthorizedError('User must be authenticated');
  }

  // Get the instance's profile for access checks + template resolution
  const instance = await db
    .select({
      profileId: processInstances.profileId,
      ownerProfileId: processInstances.ownerProfileId,
      instanceData: processInstances.instanceData,
      processId: processInstances.processId,
    })
    .from(processInstances)
    .where(eq(processInstances.id, processInstanceId))
    .limit(1);

  if (!instance[0]?.profileId) {
    throw new UnauthorizedError('User does not have access to this process');
  }

  let canManageProposals = false;
  let profileUser: Awaited<ReturnType<typeof getProfileAccessUser>> = undefined;

  // Only perform access checks if not skipped
  if (!skipAccessCheck) {
    // Check view access via profileUser on the instance's profile
    profileUser = await getProfileAccessUser({
      user,
      profileId: instance[0].profileId,
    });

    await assertInstanceProfileAccess({
      user,
      instance: instance[0],
      profilePermissions: [
        { decisions: permission.ADMIN },
        { decisions: permission.READ },
      ],
      orgFallbackPermissions: [
        { decisions: permission.ADMIN },
        { decisions: permission.READ },
      ],
    });

    // Check if user can manage proposals (approve/reject)
    canManageProposals = checkPermission(
      { profile: permission.ADMIN },
      profileUser?.roles ?? [],
    );
  }

  // Get current user's profile ID early for hidden filter and later for editable checks
  const currentProfileId = await getCurrentProfileId(input.authUserId);

  const { limit = 20, offset = 0, orderBy = 'createdAt', dir = 'desc' } = input;

  // Build shared WHERE clause using the extracted function
  const baseWhereClause = buildWhereConditions(input, phaseProposalIds);

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

  // Draft proposals: only visible to users with proposal-level access
  // (the creator and invited collaborators who have a profileUsers record on the proposal's profile).
  // Non-draft proposals: visible to all users with instance-level access,
  // but still respect the HIDDEN visibility filter (only admins and owners see hidden proposals).
  if (!skipAccessCheck) {
    // A proposal is visible if:
    // 1. It's a DRAFT and the user has proposal-level access (via profileUsers), OR
    // 2. It's not a DRAFT and passes the visibility filter
    const draftFilter = and(
      eq(proposals.status, ProposalStatus.DRAFT),
      inArray(
        proposals.profileId,
        db
          .select({ profileId: profileUsers.profileId })
          .from(profileUsers)
          .where(eq(profileUsers.authUserId, input.authUserId)),
      ),
    );

    const nonDraftFilter = ne(proposals.status, ProposalStatus.DRAFT);

    // For non-draft proposals, apply the existing HIDDEN visibility filter
    // unless the user is an admin (canManageProposals)
    const nonDraftVisibilityFilter = canManageProposals
      ? nonDraftFilter
      : and(
          nonDraftFilter,
          or(
            eq(proposals.visibility, Visibility.VISIBLE),
            eq(proposals.submittedByProfileId, currentProfileId),
          ),
        );

    const permissionFilter = or(draftFilter, nonDraftVisibilityFilter);
    whereClause = whereClause
      ? and(whereClause, permissionFilter)
      : permissionFilter;
  }

  // Get proposals with optimized ordering
  const orderColumn = proposals[orderBy] ?? proposals.createdAt;

  const orderFn = dir === 'asc' ? asc : desc;

  const [proposalList, countResult] = await Promise.all([
    db._query.proposals.findMany({
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

  // Resolve proposalTemplate from instanceData, falling back to processSchema
  const proposalTemplate = await resolveProposalTemplate(
    instance[0].instanceData as Record<string, unknown> | null,
    instance[0].processId,
  );

  type ProposalListItem = (typeof proposalList)[number];

  // Get relationship data for all proposal profiles using optimized Drizzle queries
  const profileIds = proposalList
    .map((proposal) => proposal.profileId)
    .filter((id): id is string => Boolean(id));

  const relationshipData = new Map<
    string,
    {
      likesCount: number;
      followersCount: number;
      isLikedByUser: boolean;
      isFollowedByUser: boolean;
      commentsCount: number;
    }
  >();

  // Fetch relationship data and document contents in parallel
  const [relationshipResults, documentContentMap] = await Promise.all([
    // Get relationship data if there are profile IDs
    profileIds.length > 0
      ? Promise.all([
          // Get relationship counts for all profile IDs (likes and follows)
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
                inArray(profileRelationships.targetProfileId, profileIds),
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
            .where(inArray(postsToProfiles.profileId, profileIds))
            .groupBy(postsToProfiles.profileId),
        ])
      : Promise.resolve(null),

    // Get document contents for all proposals, pinned to the submitted version
    getProposalDocumentsContent(
      proposalList.map((proposal) => {
        const parsed = parseProposalData(proposal.proposalData);
        return {
          id: proposal.id,
          proposalData: proposal.proposalData,
          proposalTemplate,
          collaborationDocVersionId:
            proposal.status === ProposalStatus.DRAFT
              ? undefined
              : parsed.collaborationDocVersionId,
        };
      }),
    ),
  ]);

  // Build the relationship data map if we have results
  if (relationshipResults) {
    const [relationshipCounts, userRelationships, commentCounts] =
      relationshipResults;

    for (const profileId of profileIds) {
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
    }
  }

  // Transform the results to match the expected structure and add decision counts, likes count, and user relationship status
  // TODO: improve this with more streamlined types
  const proposalsWithCounts = proposalList.map((proposal: ProposalListItem) => {
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

    // In results phase, proposals are never editable
    // Check if proposal is editable by current user
    const isOwner = proposal.submittedByProfileId === currentProfileId;
    const hasAdminPermission = checkPermission(
      { profile: permission.ADMIN },
      profileUser?.roles ?? [],
    );
    const isEditable =
      input.phase === 'results' ? false : isOwner || hasAdminPermission;

    return {
      id: proposal.id,
      processInstanceId: proposal.processInstanceId,
      proposalData: parseProposalData(proposal.proposalData),
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
      documentContent: documentContentMap.get(proposal.id),
      proposalTemplate,
    };
  });

  return {
    proposals: proposalsWithCounts,
    total: Number(count),
    hasMore: offset + limit < Number(count),
    canManageProposals,
  };
};
