import { and, db, eq, ilike, inArray, ne, or, sql } from '@op/db/client';
import {
  ProfileRelationshipType,
  ProposalStatus,
  Visibility,
  decisionsVoteProposals,
  decisionsVoteSubmissions,
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
   * Restrict results to proposals voted on by this profile. Bypasses phase
   * resolution so a ballot remains accessible after the process advances past
   * the voting phase.
   */
  votedByProfileId?: string;
  /**
   * Internal override: skip phase resolution and use this exact set of IDs.
   * Not exposed on the tRPC schema — public callers should use phaseId or
   * votedByProfileId.
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

/**
 * Resolves a caller-provided "explicit scope" for the listProposals query.
 *
 * Explicit scope means the caller knows the exact set of proposal IDs they
 * want, so we bypass phase resolution entirely. There are two ways to trigger
 * it:
 *
 * 1. `proposalIds` (internal-only) — used by trusted callers that already
 *    have the IDs in hand.
 * 2. `votedByProfileId` (public) — surfaces a user's ballot regardless of
 *    the current phase. Subject to a self-only auth check: a caller can only
 *    request their own ballot. The check is skipped for trusted contexts.
 *
 * Returns `undefined` when no explicit scope was requested (caller will fall
 * back to phase scoping).
 */
const resolveExplicitScope = async ({
  input,
  currentProfileId,
  skipAccessCheck,
}: {
  input: ListProposalsInput;
  currentProfileId: string | undefined;
  skipAccessCheck: boolean;
}): Promise<string[] | undefined> => {
  if (input.proposalIds !== undefined) {
    return input.proposalIds;
  }

  if (!input.votedByProfileId) {
    return undefined;
  }

  // Ballots are private: a caller can only request their own ballot.
  if (!skipAccessCheck && currentProfileId !== input.votedByProfileId) {
    throw new UnauthorizedError('You can only view your own ballot');
  }

  const votedRows = await db
    .select({ proposalId: decisionsVoteProposals.proposalId })
    .from(decisionsVoteSubmissions)
    .innerJoin(
      decisionsVoteProposals,
      eq(decisionsVoteSubmissions.id, decisionsVoteProposals.voteSubmissionId),
    )
    .where(
      and(
        eq(decisionsVoteSubmissions.processInstanceId, input.processInstanceId),
        eq(
          decisionsVoteSubmissions.submittedByProfileId,
          input.votedByProfileId,
        ),
      ),
    );

  return votedRows.map((r) => r.proposalId);
};

// Shared function to build WHERE conditions for both count and data queries.
// Accepts a table reference so the relational query API can pass an aliased
// version while the v1 select can pass the schema table directly.
const buildWhereConditions = (
  input: ListProposalsInput,
  t: typeof proposals = proposals,
) => {
  const { processInstanceId, submittedByProfileId, status, search } = input;

  const conditions = [];

  conditions.push(eq(t.processInstanceId, processInstanceId));

  if (submittedByProfileId) {
    conditions.push(eq(t.submittedByProfileId, submittedByProfileId));
  }

  if (status) {
    conditions.push(eq(t.status, status));
  }

  if (search) {
    // Search in proposal data (JSONB) - convert to text for searching
    conditions.push(ilike(sql`${t.proposalData}::text`, `%${search}%`));
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

  // Resolve the caller's profile once; it's reused for ballot auth, the
  // HIDDEN visibility filter, and owner/editable checks further down.
  const currentProfileId = await getCurrentProfileId(input.authUserId);

  const explicitScopeIds = await resolveExplicitScope({
    input,
    currentProfileId,
    skipAccessCheck,
  });

  const phaseProposalIds =
    explicitScopeIds ??
    (await getProposalIdsForPhase({
      instanceId: processInstanceId,
      phaseId: input.phaseId,
    }));

  // For trusted contexts (skipAccessCheck), drafts are never returned and phase
  // scoping is the only proposal-id filter — so an empty phase set means no results.
  // For authenticated callers we still need to consider drafts the user owns/collaborates
  // on, which are not part of phaseProposalIds, so we cannot early-return here.
  if (skipAccessCheck && phaseProposalIds.length === 0) {
    return {
      proposals: [],
      total: 0,
      hasMore: false,
      canManageProposals: false,
    };
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

  const { limit = 20, offset = 0, orderBy = 'createdAt', dir = 'desc' } = input;

  // Handle category filtering separately to avoid table reference issues
  const { categoryId } = input;
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
  }

  // Build the full WHERE clause against the supplied table reference. Used by
  // the v1 select count below (passing the schema table) and the v2 relational
  // findMany (passing the aliased table from the RAW callback).
  const buildFullWhere = (t: typeof proposals = proposals) => {
    let whereClause = buildWhereConditions(input, t);

    if (explicitScopeIds !== undefined) {
      const explicitScopeFilter =
        explicitScopeIds.length > 0
          ? inArray(t.id, explicitScopeIds)
          : sql`false`;
      whereClause = whereClause
        ? and(whereClause, explicitScopeFilter)
        : explicitScopeFilter;
    }

    if (categoryId && categoryProposalIds.length > 0) {
      const categoryFilter = inArray(t.id, categoryProposalIds);
      whereClause = whereClause
        ? and(whereClause, categoryFilter)
        : categoryFilter;
    }

    // Phase scoping applies to non-draft proposals only. Drafts are user-private
    // and not part of any phase transition snapshot, so they bypass phaseProposalIds.
    // When phaseProposalIds is empty (e.g. instance has no submitted proposals yet),
    // the non-draft branch must short-circuit to false rather than emit an empty IN ().
    const phaseScopedNonDraftIdFilter =
      phaseProposalIds.length > 0
        ? and(
            ne(t.status, ProposalStatus.DRAFT),
            inArray(t.id, phaseProposalIds),
          )
        : sql`false`;

    if (skipAccessCheck) {
      whereClause = whereClause
        ? and(whereClause, phaseScopedNonDraftIdFilter)
        : phaseScopedNonDraftIdFilter;
    } else {
      const draftFilter = and(
        eq(t.status, ProposalStatus.DRAFT),
        inArray(
          t.profileId,
          db
            .select({ profileId: profileUsers.profileId })
            .from(profileUsers)
            .where(eq(profileUsers.authUserId, input.authUserId)),
        ),
      );

      const nonDraftVisibilityFilter = canManageProposals
        ? phaseScopedNonDraftIdFilter
        : and(
            phaseScopedNonDraftIdFilter,
            or(
              eq(t.visibility, Visibility.VISIBLE),
              eq(t.submittedByProfileId, currentProfileId),
            ),
          );

      const permissionFilter = or(draftFilter, nonDraftVisibilityFilter);
      whereClause = whereClause
        ? and(whereClause, permissionFilter)
        : permissionFilter;
    }

    return whereClause;
  };

  const [proposalList, countResult] = await Promise.all([
    db.query.proposals.findMany({
      where: { RAW: (t) => buildFullWhere(t)! },
      with: {
        submittedBy: {
          with: {
            avatarImage: true,
          },
        },
        profile: true,
      },
      limit,
      offset,
      orderBy: (t, { asc, desc }) => {
        const col = t[orderBy] ?? t.createdAt;
        return dir === 'asc' ? asc(col) : desc(col);
      },
    }),
    // Get count using Drizzle's count function instead of raw SQL
    db.select({ count: countFn() }).from(proposals).where(buildFullWhere()),
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
