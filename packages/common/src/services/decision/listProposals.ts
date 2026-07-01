import {
  SQL,
  and,
  db,
  eq,
  ilike,
  inArray,
  isNull,
  ne,
  or,
  sql,
} from '@op/db/client';
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
import { type NormalizedRole, checkPermission, permission } from 'access-zones';
import { count as countFn } from 'drizzle-orm';

import {
  UnauthorizedError,
  decodeCursor,
  encodeCursor,
  getCursorCondition,
} from '../../utils';
import {
  assertInstanceProfileAccess,
  getCurrentProfileId,
  resolveAccessUserIds,
} from '../access';
import {
  getActivelyFlaggedItemIds,
  noActiveModerationFlag,
} from '../moderation/moderationVisibility';
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import { getProposalRelationshipData } from './getProposalRelationshipData';
import {
  getPhaseProposalAndDraftIds,
  getProposalIdsForPhase,
} from './getProposalsForPhase';
import { getSelectedProposalIds } from './getSelectedProposalIds';
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
  // Keyset pagination cursor from a previous page's `next` (see `getCursorCondition`).
  cursor?: string | null;
  orderBy?: 'createdAt' | 'updatedAt' | 'status' | 'votes';
  dir?: 'asc' | 'desc';
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

  return votedRows.map((row) => row.proposalId);
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
  const conditions: SQL[] = [
    eq(t.processInstanceId, processInstanceId),
    // Moderation-detached (CSAM) proposals are invisible to everyone,
    // including admins and even trusted background contexts. Applied in the
    // base conditions so every branch of the query builder inherits it.
    isNull(t.moderationDetachedAt),
  ];

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
  user: User | undefined;
}) => {
  const { processInstanceId, skipAccessCheck = false } = input;

  // Resolve the caller's profile once; it's reused for ballot auth, the
  // HIDDEN visibility filter, and owner/editable checks further down. Public
  // (no-JWT) and anonymous callers have no account profile — treat as none.
  let currentProfileId: string | undefined;
  if (user) {
    try {
      currentProfileId = await getCurrentProfileId(user.id);
    } catch {
      currentProfileId = undefined;
    }
  }

  // Caller's own grants unioned with public (GLOBAL_USER_PUBLIC) grants — used
  // for the draft and HIDDEN visibility subqueries below.
  // INVARIANT: public grants must only be placed on the process/decision
  // profile, never on an individual proposal profile — otherwise this would
  // surface every caller's drafts/HIDDEN proposals to the public.
  const accessUserIds = resolveAccessUserIds(user);

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
      authUserIds: accessUserIds,
    });
    return { phaseProposalIds: ids.nonDraftIds, phaseDraftIds: ids.draftIds };
  })();

  // Run access checks in parallel with the phase-IDs resolution. Both depend
  // only on the instance row (already fetched), so there's no ordering
  // dependency — the auth check still throws on failure, just slightly later.
  const accessPromise: Promise<{
    profileRoles: NormalizedRole[];
    canManageProposals: boolean;
  }> = (async () => {
    if (skipAccessCheck) {
      return { profileRoles: [], canManageProposals: false };
    }
    const profileRoles = await assertInstanceProfileAccess({
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
      profileRoles,
      canManageProposals: checkPermission(
        { profile: permission.ADMIN },
        profileRoles,
      ),
    };
  })();

  const [
    { phaseProposalIds, phaseDraftIds },
    { profileRoles, canManageProposals },
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
      next: null,
    };
  }

  const { limit = 20, orderBy = 'createdAt', dir = 'desc' } = input;
  const decodedCursor = input.cursor
    ? decodeCursor<{ value: string | Date; id: string }>(input.cursor)
    : undefined;

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
        next: null,
      };
    }
  }

  // Assemble the full WHERE clause. Parameterized on the table reference so
  // the same builder can be used for the v2 relational findMany (where Drizzle
  // passes an aliased `table`) and the plain count query (which passes the
  // schema table). See `buildBaseConditions` above for the same pattern.
  const buildWhereClause = (proposalsTable: typeof proposals): SQL => {
    let clause: SQL = buildBaseConditions(proposalsTable, input);

    // Explicit scope (proposalIds or votedByProfileId): constrain the entire
    // query to that ID set so the draft branch can't independently surface
    // drafts the user owns but didn't ask for.
    if (explicitScopeIds !== undefined) {
      const explicitScopeFilter =
        explicitScopeIds.length > 0
          ? inArray(proposalsTable.id, explicitScopeIds)
          : sql`false`;
      clause = and(clause, explicitScopeFilter)!;
    }

    if (categoryProposalIds.length > 0) {
      clause = and(clause, inArray(proposalsTable.id, categoryProposalIds))!;
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
            ne(proposalsTable.status, ProposalStatus.DRAFT),
            inArray(proposalsTable.id, phaseProposalIds),
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
        ? and(
            eq(proposalsTable.status, ProposalStatus.DRAFT),
            inArray(proposalsTable.id, phaseDraftIds),
          )!
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
            eq(proposalsTable.visibility, Visibility.VISIBLE),
            inArray(
              proposalsTable.profileId,
              db
                .select({ profileId: profileUsers.profileId })
                .from(profileUsers)
                .where(inArray(profileUsers.authUserId, accessUserIds)),
            ),
          )!,
        )!;

    // Items with an active moderation flag are hidden from everyone except
    // members of the proposal's own profile (creator + invited collaborators);
    // instance admins (canManageProposals) skip the filter entirely. The owner
    // audience is proposal.profileId membership — the same set getProposal
    // grants the flagged proposal to — so the list and detail views agree
    // (keying on submittedByProfileId alone would diverge for group-owned
    // proposals). Applied in SQL so pagination stays correct.
    const moderationFilter = canManageProposals
      ? undefined
      : or(
          noActiveModerationFlag('proposal', proposalsTable.id),
          inArray(
            proposalsTable.profileId,
            db
              .select({ profileId: profileUsers.profileId })
              .from(profileUsers)
              .where(inArray(profileUsers.authUserId, accessUserIds)),
          ),
        )!;

    return and(
      clause,
      or(draftFilter, nonDraftVisibilityFilter)!,
      moderationFilter,
    )!;
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

  const [rawProposalList, countResult] = await Promise.all([
    db.query.proposals.findMany({
      // Cursor lives only on the data query so `total` stays the full count.
      // `votes` sorts by a computed aggregate, so it can't keyset (never paginated).
      where: {
        RAW: (table) =>
          and(
            buildWhereClause(table),
            orderBy === 'votes'
              ? undefined
              : getCursorCondition({
                  column: table[orderBy] ?? table.createdAt,
                  tieBreakerColumn: table.id,
                  cursor: decodedCursor,
                  direction: dir,
                }),
          )!,
      },
      with: {
        submittedBy: {
          with: {
            avatarImage: true,
            profileUsers: {
              columns: {},
              with: { authUser: { columns: { isAnonymous: true } } },
            },
          },
        },
        profile: true,
      },
      // Fetch one extra to detect whether a next page exists.
      limit: limit + 1,
      ...(includeVoteCounts && {
        extras: {
          voteCount: (table, { sql: sqlOp }) =>
            sqlOp<number>`${voteCountExpr(table)}`.as('vote_count'),
        },
      }),
      orderBy: (table, { asc: ascOp, desc: descOp }) => {
        // `id` tie-break: without it, rows sharing the primary sort key
        // return in undefined order and flipping `dir` has no visible effect.
        const directional = dir === 'asc' ? ascOp : descOp;
        if (orderBy === 'votes') {
          return [
            descOp(voteCountExpr(table)),
            descOp(table.createdAt),
            descOp(table.id),
          ];
        }
        return [
          directional(table[orderBy] ?? table.createdAt),
          directional(table.id),
        ];
      },
    }),
    // Count uses the same builder against the schema table, producing
    // unaliased SQL that matches the FROM clause here.
    db
      .select({ count: countFn() })
      .from(proposals)
      .where(buildWhereClause(proposals)),
  ]);

  const count = countResult[0]?.count || 0;

  const hasMore = rawProposalList.length > limit;
  const proposalList = hasMore
    ? rawProposalList.slice(0, limit)
    : rawProposalList;

  type ProposalListItem = (typeof proposalList)[number];

  // Resolve proposalTemplate from instanceData, falling back to processSchema
  const proposalTemplate = await resolveProposalTemplate(
    instance.instanceData as Record<string, unknown> | null,
    instance.processId,
  );

  const profileIds = proposalList
    .map((proposal) => proposal.profileId)
    .filter((id): id is string => Boolean(id));

  const [relationshipData, documentContentMap, selectedIds, flaggedIds] =
    await Promise.all([
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
        // A single unavailable document must not break the whole list.
        { onFetchError: 'omit' },
      ),
      getSelectedProposalIds(processInstanceId),
      // Flagged items reach this point only for their creator or an admin —
      // decorate them so the UI can render the "Flagged" indicator.
      getActivelyFlaggedItemIds(
        'proposal',
        proposalList.map((proposal) => proposal.id),
      ),
    ]);

  const hasAdminPermission = checkPermission(
    { profile: permission.ADMIN },
    profileRoles,
  );

  const proposalsWithCounts = proposalList.map((proposal: ProposalListItem) => {
    const rawSubmittedBy = Array.isArray(proposal.submittedBy)
      ? proposal.submittedBy[0]
      : proposal.submittedBy;
    const submittedBy = rawSubmittedBy
      ? (() => {
          const { profileUsers, ...author } = rawSubmittedBy;
          return {
            ...author,
            isAnonymous: Boolean(
              profileUsers?.some(
                (pu: { authUser: { isAnonymous: boolean } | null }) =>
                  pu.authUser?.isAnonymous,
              ),
            ),
          };
        })()
      : rawSubmittedBy;
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
      isSelected: selectedIds.has(proposal.id),
      isFlagged: flaggedIds.has(proposal.id),
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

  // Keyset cursor off the last row's sort value + id tiebreak (votes can't
  // keyset, so it stays a single page).
  const lastItem = proposalsWithCounts[proposalsWithCounts.length - 1];
  const cursorValue =
    lastItem && orderBy !== 'votes' ? lastItem[orderBy] : null;
  // `!= null` (not a truthy check) so a falsy-but-valid sort value — e.g. a
  // rubric score of 0 — still produces a cursor instead of silently ending.
  const next =
    hasMore && lastItem && cursorValue != null
      ? encodeCursor<{ value: string | Date; id: string }>({
          value: cursorValue,
          id: lastItem.id,
        })
      : null;

  return {
    proposals: proposalsWithCounts,
    total: Number(count),
    hasMore,
    canManageProposals,
    next,
  };
};
