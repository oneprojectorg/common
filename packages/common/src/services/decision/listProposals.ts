import {
  type SQL,
  and,
  asc,
  db,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  ne,
  notInArray,
  or,
  sql,
} from '@op/db/client';
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
import {
  getPhaseProposalAndDraftIds,
  getProposalIdsForPhase,
} from './getProposalsForPhase';
import { parseProposalData } from './proposalDataSchema';
import { resolveProposalTemplate } from './resolveProposalTemplate';

/** Fields shared by both phase-scoped and all-scoped proposal listings. */
interface BaseListInput {
  processInstanceId: string;
  submittedByProfileId?: string;
  status?: ProposalStatus;
  search?: string;
  categoryId?: string;
  /**
   * Restrict results to proposals voted on by this profile. Used by both
   * scopes so a user's ballot remains accessible regardless of the current
   * phase.
   */
  votedByProfileId?: string;
  /**
   * Internal override: use this exact set of IDs. Not exposed on the tRPC
   * schema — public callers should use phaseId (phase) or votedByProfileId.
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

export interface ListProposalsInput extends BaseListInput {
  /**
   * Phase to scope results to. Defaults to the instance's current phase when
   * omitted.
   */
  phaseId?: string;
}

/** Input for `listAllProposals` — no `phaseId` since phase scoping doesn't apply. */
export type ListAllProposalsInput = BaseListInput;

type Instance = {
  id: string;
  profileId: string | null;
  ownerProfileId: string | null;
  instanceData: unknown;
  processId: string;
  currentStateId: string | null;
};

type AccessResult = {
  profileUser: Awaited<ReturnType<typeof getProfileAccessUser>>;
  canManageProposals: boolean;
};

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
  input: BaseListInput;
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

// Shared function to build WHERE conditions for both count and data queries
const buildWhereConditions = (input: BaseListInput) => {
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

// Predicate for the `'all'` scope: every non-draft, non-rejected, non-duplicate,
// non-deleted proposal on the instance. When `canBypassVisibility` is false, the
// HIDDEN visibility filter is applied — proposals stay visible to members of
// the owning profile via a `profileUsers` subquery pushed into SQL.
const buildAllScopeFilter = ({
  authUserId,
  canBypassVisibility,
}: {
  authUserId: string;
  canBypassVisibility: boolean;
}) => {
  const validStatusFilter = notInArray(proposals.status, [
    ProposalStatus.DRAFT,
    ProposalStatus.REJECTED,
    ProposalStatus.DUPLICATE,
  ]);
  const deletedAtFilter = isNull(proposals.deletedAt);

  if (canBypassVisibility) {
    return and(validStatusFilter, deletedAtFilter);
  }

  return and(
    validStatusFilter,
    deletedAtFilter,
    or(
      eq(proposals.visibility, Visibility.VISIBLE),
      inArray(
        proposals.profileId,
        db
          .select({ profileId: profileUsers.profileId })
          .from(profileUsers)
          .where(eq(profileUsers.authUserId, authUserId)),
      ),
    ),
  );
};

type ListContext = {
  instance: Instance;
  currentProfileId: string;
  explicitScopeIds: string[] | undefined;
  profileUser: AccessResult['profileUser'];
  canManageProposals: boolean;
};

const runAccessCheck = async ({
  user,
  instance,
  skipAccessCheck,
}: {
  user: User;
  instance: Instance;
  skipAccessCheck: boolean;
}): Promise<AccessResult> => {
  if (skipAccessCheck) {
    return { profileUser: undefined, canManageProposals: false };
  }
  if (!instance.profileId) {
    throw new UnauthorizedError('User does not have access to this process');
  }
  const profileUser = await getProfileAccessUser({
    user,
    profileId: instance.profileId,
  });
  await assertInstanceProfileAccess({
    user,
    instance,
    profilePermissions: [
      { decisions: permission.ADMIN },
      { decisions: permission.READ },
    ],
    orgFallbackPermissions: [
      { decisions: permission.ADMIN },
      { decisions: permission.READ },
    ],
  });
  return {
    profileUser,
    canManageProposals: checkPermission(
      { profile: permission.ADMIN },
      profileUser?.roles ?? [],
    ),
  };
};

// Shared setup for both list paths: validate auth, fetch the instance, resolve
// the caller's profile, then run explicit-scope resolution and the access check
// in parallel.
const resolveListContext = async ({
  input,
  user,
}: {
  input: BaseListInput;
  user: User;
}): Promise<ListContext> => {
  const { processInstanceId, skipAccessCheck = false } = input;

  if (!skipAccessCheck && !user) {
    throw new UnauthorizedError('User must be authenticated');
  }

  const [instanceRows, currentProfileId] = await Promise.all([
    db
      .select({
        id: processInstances.id,
        profileId: processInstances.profileId,
        ownerProfileId: processInstances.ownerProfileId,
        instanceData: processInstances.instanceData,
        processId: processInstances.processId,
        currentStateId: processInstances.currentStateId,
      })
      .from(processInstances)
      .where(eq(processInstances.id, processInstanceId))
      .limit(1),
    getCurrentProfileId(input.authUserId),
  ]);

  const instance = instanceRows[0];
  if (!instance?.profileId) {
    throw new UnauthorizedError('User does not have access to this process');
  }

  const [explicitScopeIds, access] = await Promise.all([
    resolveExplicitScope({ input, currentProfileId, skipAccessCheck }),
    runAccessCheck({ user, instance, skipAccessCheck }),
  ]);

  return {
    instance,
    currentProfileId,
    explicitScopeIds,
    profileUser: access.profileUser,
    canManageProposals: access.canManageProposals,
  };
};

// Single source of truth for the proposal query shape used by both scope paths.
// Type-feeds `hydrateAndTransformProposals` via `Awaited<ReturnType<...>>`.
const findProposalsForList = ({
  whereClause,
  orderByExpr,
  limit,
  offset,
}: {
  whereClause: SQL | undefined;
  orderByExpr: SQL;
  limit: number;
  offset: number;
}) =>
  db._query.proposals.findMany({
    where: whereClause,
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
    orderBy: orderByExpr,
  });

type ProposalRow = Awaited<ReturnType<typeof findProposalsForList>>[number];

const hydrateAndTransformProposals = async ({
  proposalList,
  count,
  instance,
  currentProfileId,
  profileUser,
  phase,
  offset,
  limit,
  canManageProposals,
}: {
  proposalList: ProposalRow[];
  count: number;
  instance: Pick<Instance, 'instanceData' | 'processId'>;
  currentProfileId: string;
  profileUser: Awaited<ReturnType<typeof getProfileAccessUser>>;
  phase: 'results' | undefined;
  offset: number;
  limit: number;
  canManageProposals: boolean;
}) => {
  const proposalTemplate = await resolveProposalTemplate(
    instance.instanceData as Record<string, unknown> | null,
    instance.processId,
  );

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

  const [relationshipResults, documentContentMap] = await Promise.all([
    profileIds.length > 0
      ? Promise.all([
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

  // TODO: improve this with more streamlined types
  const proposalsWithCounts = proposalList.map((proposal: ProposalRow) => {
    const submittedBy = Array.isArray(proposal.submittedBy)
      ? proposal.submittedBy[0]
      : proposal.submittedBy;
    const profile = Array.isArray(proposal.profile)
      ? proposal.profile[0]
      : proposal.profile;
    const relationshipInfo = proposal.profileId
      ? relationshipData.get(proposal.profileId)
      : null;

    const isOwner = proposal.submittedByProfileId === currentProfileId;
    const hasAdminPermission = checkPermission(
      { profile: permission.ADMIN },
      profileUser?.roles ?? [],
    );
    const isEditable =
      phase === 'results' ? false : isOwner || hasAdminPermission;

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

// Applies the caller's explicit-scope override (proposalIds / votedByProfileId)
// to a WHERE clause. `sql\`false\`` short-circuits the query when the explicit
// set is empty, instead of emitting an empty `IN ()`.
const applyExplicitScopeFilter = (
  whereClause: SQL | undefined,
  explicitScopeIds: string[] | undefined,
): SQL | undefined => {
  if (explicitScopeIds === undefined) {
    return whereClause;
  }
  const filter =
    explicitScopeIds.length > 0
      ? inArray(proposals.id, explicitScopeIds)
      : sql`false`;
  return whereClause ? and(whereClause, filter) : filter;
};

// Resolves the optional category filter into a WHERE-clause fragment.
// Returns `null` when the category exists but has no proposals — the caller
// short-circuits to an empty result in that case.
const applyCategoryFilter = async (
  whereClause: SQL | undefined,
  categoryId: string | undefined,
): Promise<SQL | undefined | null> => {
  if (!categoryId) {
    return whereClause;
  }
  const rows = await db
    .select({ proposalId: proposalCategories.proposalId })
    .from(proposalCategories)
    .where(eq(proposalCategories.taxonomyTermId, categoryId));

  if (rows.length === 0) {
    return null;
  }
  const filter = inArray(
    proposals.id,
    rows.map((r) => r.proposalId),
  );
  return whereClause ? and(whereClause, filter) : filter;
};

/**
 * Returns every valid (non-draft, non-rejected, non-duplicate, non-deleted)
 * proposal on the instance, ignoring phase scoping. HIDDEN visibility is still
 * applied for non-admin callers. Used by the "All proposals" tab on the
 * results page.
 */
export const listAllProposals = async ({
  input,
  user,
}: {
  input: ListAllProposalsInput;
  user: User;
}) => {
  const {
    instance,
    currentProfileId,
    explicitScopeIds,
    profileUser,
    canManageProposals,
  } = await resolveListContext({ input, user });

  const {
    skipAccessCheck = false,
    limit = 20,
    offset = 0,
    orderBy = 'createdAt',
    dir = 'desc',
  } = input;

  let whereClause = applyExplicitScopeFilter(
    buildWhereConditions(input),
    explicitScopeIds,
  );

  const afterCategory = await applyCategoryFilter(
    whereClause,
    input.categoryId,
  );
  if (afterCategory === null) {
    return { proposals: [], total: 0, hasMore: false, canManageProposals };
  }
  whereClause = afterCategory;

  const validFilter = buildAllScopeFilter({
    authUserId: input.authUserId,
    canBypassVisibility: skipAccessCheck || canManageProposals,
  });
  whereClause = whereClause ? and(whereClause, validFilter) : validFilter;

  const orderColumn = proposals[orderBy] ?? proposals.createdAt;
  const orderFn = dir === 'asc' ? asc : desc;

  const [proposalList, countResult] = await Promise.all([
    findProposalsForList({
      whereClause,
      orderByExpr: orderFn(orderColumn),
      limit,
      offset,
    }),
    db.select({ count: countFn() }).from(proposals).where(whereClause),
  ]);

  return hydrateAndTransformProposals({
    proposalList,
    count: countResult[0]?.count || 0,
    instance,
    currentProfileId,
    profileUser,
    phase: input.phase,
    offset,
    limit,
    canManageProposals,
  });
};

/**
 * Returns proposals visible in the given phase (defaults to the instance's
 * current phase). Drafts are phase-scoped to their `createdAt` window and
 * filtered to the caller and their collaborators; non-drafts have the HIDDEN
 * visibility filter applied for non-admin callers.
 */
export const listProposals = async ({
  input,
  user,
}: {
  input: ListProposalsInput;
  user: User;
}) => {
  const { skipAccessCheck = false } = input;

  const {
    instance,
    currentProfileId,
    explicitScopeIds,
    profileUser,
    canManageProposals,
  } = await resolveListContext({ input, user });

  // Resolve phase-scoped IDs for non-drafts and drafts. Drafts are phase-scoped
  // via a `createdAt` window since they're never attached to transition
  // snapshots. The combined resolver shares a single instance-context lookup
  // and window resolution across both queries; we only fall back to it for
  // authenticated callers that need both sets.
  const { phaseProposalIds, phaseDraftIds } = await (async () => {
    if (explicitScopeIds !== undefined) {
      // Caller specified the exact ID set (proposalIds or votedByProfileId).
      // Drafts can't appear in either: proposalIds is internal and
      // votedByProfileId only matches submitted proposals on a ballot.
      return {
        phaseProposalIds: explicitScopeIds,
        phaseDraftIds: [] as string[],
      };
    }
    if (skipAccessCheck) {
      // Trusted contexts (background jobs) never surface drafts.
      const ids = await getProposalIdsForPhase({
        instance,
        phaseId: input.phaseId,
      });
      return { phaseProposalIds: ids, phaseDraftIds: [] as string[] };
    }
    const ids = await getPhaseProposalAndDraftIds({
      instance,
      phaseId: input.phaseId,
      authUserId: input.authUserId,
    });
    return { phaseProposalIds: ids.nonDraftIds, phaseDraftIds: ids.draftIds };
  })();

  // For trusted contexts, drafts are never returned and phase scoping is the
  // only proposal-id filter — so an empty phase set means no results. For
  // authenticated callers, drafts have their own phase-scoped ID set
  // (`phaseDraftIds`) which may surface results even when `phaseProposalIds` is
  // empty, so we cannot early-return.
  if (skipAccessCheck && phaseProposalIds.length === 0) {
    return {
      proposals: [],
      total: 0,
      hasMore: false,
      canManageProposals: false,
    };
  }

  const { limit = 20, offset = 0, orderBy = 'createdAt', dir = 'desc' } = input;

  let whereClause = applyExplicitScopeFilter(
    buildWhereConditions(input),
    explicitScopeIds,
  );

  const afterCategory = await applyCategoryFilter(
    whereClause,
    input.categoryId,
  );
  if (afterCategory === null) {
    return { proposals: [], total: 0, hasMore: false, canManageProposals };
  }
  whereClause = afterCategory;

  // Phase scoping applies separately to non-drafts and drafts. Non-drafts are
  // resolved via transition snapshots + a strict `createdAt` window; drafts use
  // a half-open `createdAt` window only (they're never attached to a snapshot).
  // When the relevant ID set is empty (e.g. instance has no submitted proposals
  // yet), each branch must short-circuit to false rather than emit an empty IN ().
  const phaseScopedNonDraftIdFilter =
    phaseProposalIds.length > 0
      ? and(
          ne(proposals.status, ProposalStatus.DRAFT),
          inArray(proposals.id, phaseProposalIds),
        )
      : sql`false`;

  if (skipAccessCheck) {
    whereClause = whereClause
      ? and(whereClause, phaseScopedNonDraftIdFilter)
      : phaseScopedNonDraftIdFilter;
  } else {
    // Draft proposals are phase-scoped to their `createdAt` window: a draft made
    // in Phase 1 is only visible when viewing Phase 1, even after the instance
    // advances. Ownership scoping (creator + invited collaborators via
    // `profileUsers`) is applied inside `getPhaseProposalAndDraftIds` via a
    // subquery, so `phaseDraftIds` is already access-filtered — no further
    // ownership filter is needed here.
    const draftFilter =
      phaseDraftIds.length > 0
        ? and(
            eq(proposals.status, ProposalStatus.DRAFT),
            inArray(proposals.id, phaseDraftIds),
          )
        : sql`false`;

    // Non-draft proposals: phase-scoped, plus the HIDDEN visibility filter for
    // non-admins. Hidden proposals stay visible to the creator and any invited
    // collaborators on the proposal's profile — same pattern the draft filter
    // uses, so a collaborator's view of a co-authored proposal doesn't change
    // the moment it's submitted with HIDDEN visibility.
    const nonDraftVisibilityFilter = canManageProposals
      ? phaseScopedNonDraftIdFilter
      : and(
          phaseScopedNonDraftIdFilter,
          or(
            eq(proposals.visibility, Visibility.VISIBLE),
            inArray(
              proposals.profileId,
              db
                .select({ profileId: profileUsers.profileId })
                .from(profileUsers)
                .where(eq(profileUsers.authUserId, input.authUserId)),
            ),
          ),
        );

    const permissionFilter = or(draftFilter, nonDraftVisibilityFilter);
    whereClause = whereClause
      ? and(whereClause, permissionFilter)
      : permissionFilter;
  }

  const orderColumn = proposals[orderBy] ?? proposals.createdAt;
  const orderFn = dir === 'asc' ? asc : desc;

  const [proposalList, countResult] = await Promise.all([
    findProposalsForList({
      whereClause,
      orderByExpr: orderFn(orderColumn),
      limit,
      offset,
    }),
    db.select({ count: countFn() }).from(proposals).where(whereClause),
  ]);

  return hydrateAndTransformProposals({
    proposalList,
    count: countResult[0]?.count || 0,
    instance,
    currentProfileId,
    profileUser,
    phase: input.phase,
    offset,
    limit,
    canManageProposals,
  });
};
