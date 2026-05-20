import { SQL, and, db, eq, ilike, inArray, ne, or, sql } from '@op/db/client';
import {
  ProposalStatus,
  Visibility,
  decisionsVoteProposals,
  decisionsVoteSubmissions,
  processInstances,
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
import { getProposalRelationshipData } from './getProposalRelationshipData';
import {
  getPhaseProposalAndDraftIds,
  getProposalIdsForPhase,
} from './getProposalsForPhase';
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
  orderBy?: 'createdAt' | 'updatedAt' | 'status' | 'votes';
  dir?: 'asc' | 'desc';
  authUserId: string;
  skipAccessCheck?: boolean; // For trusted contexts like background jobs
  /**
   * When true, each returned proposal carries a `voteCount` aggregated from
   * vote submissions on `processInstanceId`. Pair with `orderBy: 'votes'` to
   * have the database drive the sort (descending count, createdAt tiebreak).
   */
  includeVoteCounts?: boolean;
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
// Parameterized on the table reference so callers can pass either the schema
// table (for plain `db.select(...).from(proposals).where(...)`) or the
// relationally-aliased table from a v2 `RAW` callback. Both forms yield SQL
// that resolves to the right alias in their respective query contexts.
const buildBaseConditions = (
  t: typeof proposals,
  input: ListProposalsInput,
): SQL => {
  const { processInstanceId, submittedByProfileId, status, search } = input;

  // processInstanceId is always present, so the array is non-empty and the
  // final `and(...)` is guaranteed to return a SQL value.
  const conditions: SQL[] = [eq(t.processInstanceId, processInstanceId)];

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

  return and(...conditions)!;
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

  // Fetch the instance row up front and resolve the explicit ID scope in
  // parallel. The row is reused for the phase-resolution context (instead of
  // re-reading inside getInstanceContext), the access checks, and template
  // resolution.
  const [instanceRows, explicitScopeIds] = await Promise.all([
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
    resolveExplicitScope({ input, currentProfileId, skipAccessCheck }),
  ]);

  const instance = instanceRows[0];
  if (!instance?.profileId) {
    throw new UnauthorizedError('User does not have access to this process');
  }
  const instanceProfileId = instance.profileId;

  // Resolve phase-scoped IDs for non-drafts and drafts. Drafts are phase-scoped
  // via a `createdAt` window since they're never attached to transition
  // snapshots. The combined resolver shares a single instance-context lookup
  // and window resolution across both queries; we only fall back to it for
  // authenticated callers that need both sets. These are IDs only — the
  // findMany below hydrates full rows using them as filter input.
  const phaseIdsPromise: Promise<{
    phaseProposalIds: string[];
    phaseDraftIds: string[];
  }> = (async () => {
    if (explicitScopeIds !== undefined) {
      // Caller specified the exact ID set (proposalIds or votedByProfileId).
      // Drafts can't appear in either: proposalIds is internal and
      // votedByProfileId only matches submitted proposals on a ballot.
      return { phaseProposalIds: explicitScopeIds, phaseDraftIds: [] };
    }
    if (skipAccessCheck) {
      // Trusted contexts (background jobs) never surface drafts, so only
      // resolve the non-draft phase set. Legacy instances and instances
      // without a current phase fall back to all active non-drafts inside
      // `getProposalIdsForPhase`.
      const ids = await getProposalIdsForPhase({
        instance,
        phaseId: input.phaseId,
      });
      return { phaseProposalIds: ids, phaseDraftIds: [] };
    }
    const ids = await getPhaseProposalAndDraftIds({
      instance,
      phaseId: input.phaseId,
      authUserId: input.authUserId,
    });
    return { phaseProposalIds: ids.nonDraftIds, phaseDraftIds: ids.draftIds };
  })();

  // Run access checks in parallel with the phase-IDs resolution. Both depend
  // only on the instance row (already fetched), so there's no ordering
  // dependency — the auth check still throws on failure, just slightly later.
  const accessPromise: Promise<{
    profileUser: Awaited<ReturnType<typeof getProfileAccessUser>>;
    canManageProposals: boolean;
  }> = (async () => {
    if (skipAccessCheck) {
      return { profileUser: undefined, canManageProposals: false };
    }
    const profileUser = await getProfileAccessUser({
      user,
      profileId: instanceProfileId,
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
  })();

  const [
    { phaseProposalIds, phaseDraftIds },
    { profileUser, canManageProposals },
  ] = await Promise.all([phaseIdsPromise, accessPromise]);

  // For trusted contexts (skipAccessCheck), drafts are never returned and phase
  // scoping is the only proposal-id filter — so an empty phase set means no results.
  // For authenticated callers, drafts have their own phase-scoped ID set
  // (`phaseDraftIds`) which may surface results even when `phaseProposalIds` is
  // empty, so we cannot early-return here.
  if (skipAccessCheck && phaseProposalIds.length === 0) {
    return {
      proposals: [],
      total: 0,
      hasMore: false,
      canManageProposals: false,
    };
  }

  const { limit = 20, offset = 0, orderBy = 'createdAt', dir = 'desc' } = input;

  // Resolve category-scoped proposal IDs up front so the same ID set is
  // available to both the count and data queries when assembling conditions.
  const { categoryId } = input;
  let categoryProposalIds: string[] = [];

  if (categoryId) {
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

  // Assemble the full WHERE clause. Parameterized on the table reference so
  // the same builder can be used for the v2 relational findMany (where Drizzle
  // passes an aliased `table`) and the plain count query (which passes the
  // schema table). See `buildBaseConditions` above for the same pattern.
  const buildWhereClause = (t: typeof proposals): SQL => {
    let clause: SQL = buildBaseConditions(t, input);

    // Explicit scope (proposalIds or votedByProfileId): constrain the entire
    // query to that ID set so the draft branch can't independently surface
    // drafts the user owns but didn't ask for.
    if (explicitScopeIds !== undefined) {
      const explicitScopeFilter =
        explicitScopeIds.length > 0
          ? inArray(t.id, explicitScopeIds)
          : sql`false`;
      clause = and(clause, explicitScopeFilter)!;
    }

    if (categoryProposalIds.length > 0) {
      clause = and(clause, inArray(t.id, categoryProposalIds))!;
    }

    // Phase scoping applies separately to non-drafts and drafts. Non-drafts
    // are resolved via transition snapshots + a strict `createdAt` window;
    // drafts use a half-open `createdAt` window only (they're never attached
    // to a snapshot). When the relevant ID set is empty (e.g. instance has no
    // submitted proposals yet), each branch must short-circuit to false rather
    // than emit an empty `IN ()`.
    const phaseScopedNonDraftIdFilter =
      phaseProposalIds.length > 0
        ? and(
            ne(t.status, ProposalStatus.DRAFT),
            inArray(t.id, phaseProposalIds),
          )!
        : sql`false`;

    if (skipAccessCheck) {
      // Trusted contexts get all phase-scoped non-draft proposals.
      return and(clause, phaseScopedNonDraftIdFilter)!;
    }

    // Draft proposals are phase-scoped to their `createdAt` window: a draft
    // made in Phase 1 is only visible when viewing Phase 1, even after the
    // instance advances. Ownership scoping (creator + invited collaborators
    // via `profileUsers`) is applied inside `getPhaseProposalAndDraftIds` via
    // a subquery, so `phaseDraftIds` is already access-filtered — no further
    // ownership filter is needed here.
    const draftFilter =
      phaseDraftIds.length > 0
        ? and(eq(t.status, ProposalStatus.DRAFT), inArray(t.id, phaseDraftIds))!
        : sql`false`;

    // Non-draft proposals: phase-scoped, plus the HIDDEN visibility filter
    // for non-admins. Hidden proposals stay visible to the creator and any
    // invited collaborators on the proposal's profile — same pattern the
    // draft filter uses, so a collaborator's view of a co-authored proposal
    // doesn't change the moment it's submitted with HIDDEN visibility.
    const nonDraftVisibilityFilter = canManageProposals
      ? phaseScopedNonDraftIdFilter
      : and(
          phaseScopedNonDraftIdFilter,
          or(
            eq(t.visibility, Visibility.VISIBLE),
            inArray(
              t.profileId,
              db
                .select({ profileId: profileUsers.profileId })
                .from(profileUsers)
                .where(eq(profileUsers.authUserId, input.authUserId)),
            ),
          )!,
        )!;

    return and(clause, or(draftFilter, nonDraftVisibilityFilter)!)!;
  };

  const { includeVoteCounts = false } = input;

  // Vote-count correlated subquery factory. Called by both the `extras`
  // callback and the `orderBy` callback so each receives the v2-aliased
  // `table` and embeds the correct outer-column reference.
  //
  // Scoping the join to `processInstanceId` ensures cross-instance ballots
  // can't inflate counts.
  const voteCountExpr = (t: typeof proposals) =>
    sql<number>`(
      SELECT COUNT(*)::int FROM ${decisionsVoteSubmissions}
      INNER JOIN ${decisionsVoteProposals}
        ON ${decisionsVoteProposals.voteSubmissionId} = ${decisionsVoteSubmissions.id}
      WHERE ${decisionsVoteProposals.proposalId} = ${t.id}
      AND ${decisionsVoteSubmissions.processInstanceId} = ${input.processInstanceId}
    )`;

  const [proposalList, countResult] = await Promise.all([
    db.query.proposals.findMany({
      where: { RAW: (table) => buildWhereClause(table)! },
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
      ...(includeVoteCounts && {
        extras: {
          voteCount: (table, { sql: sqlOp }) =>
            sqlOp<number>`${voteCountExpr(table)}`.as('vote_count'),
        },
      }),
      orderBy: (table, { asc: ascOp, desc: descOp }) =>
        orderBy === 'votes'
          ? [descOp(voteCountExpr(table)), descOp(table.createdAt)]
          : (dir === 'asc' ? ascOp : descOp)(table[orderBy] ?? table.createdAt),
    }),
    // Count uses the same builder against the schema table, producing
    // unaliased SQL that matches the FROM clause here.
    db
      .select({ count: countFn() })
      .from(proposals)
      .where(buildWhereClause(proposals)),
  ]);

  const count = countResult[0]?.count || 0;

  // Resolve proposalTemplate from instanceData, falling back to processSchema
  const proposalTemplate = await resolveProposalTemplate(
    instance.instanceData as Record<string, unknown> | null,
    instance.processId,
  );

  const profileIds = proposalList
    .map((proposal) => proposal.profileId)
    .filter((id): id is string => Boolean(id));

  const [relationshipData, documentContentMap] = await Promise.all([
    getProposalRelationshipData({ profileIds, currentProfileId }),
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

  const hasAdminPermission = checkPermission(
    { profile: permission.ADMIN },
    profileUser?.roles ?? [],
  );

  const proposalsWithCounts = proposalList.map((proposal) => {
    const submittedBy = Array.isArray(proposal.submittedBy)
      ? proposal.submittedBy[0]
      : proposal.submittedBy;
    const profile = Array.isArray(proposal.profile)
      ? proposal.profile[0]
      : proposal.profile;
    const relationshipInfo = relationshipData.get(proposal.profileId);

    // In results phase, proposals are never editable.
    const isOwner = proposal.submittedByProfileId === currentProfileId;
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
      submittedBy,
      profile,
      likesCount: relationshipInfo?.likesCount || 0,
      followersCount: relationshipInfo?.followersCount || 0,
      isLikedByUser: relationshipInfo?.isLikedByUser || false,
      isFollowedByUser: relationshipInfo?.isFollowedByUser || false,
      commentsCount: relationshipInfo?.commentsCount || 0,
      isEditable,
      documentContent: documentContentMap.get(proposal.id),
      proposalTemplate,
      ...(includeVoteCounts && {
        voteCount: Number(
          (proposal as ProposalListItem & { voteCount?: number | string })
            .voteCount ?? 0,
        ),
      }),
    };
  });

  return {
    proposals: proposalsWithCounts,
    total: Number(count),
    hasMore: offset + limit < Number(count),
    canManageProposals,
  };
};
