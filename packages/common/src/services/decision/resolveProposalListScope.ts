import {
  SQL,
  and,
  db,
  eq,
  exists,
  ilike,
  inArray,
  isNull,
  ne,
  notExists,
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
  profiles,
  proposalCategories,
  proposalReviewAssignments,
  proposals,
} from '@op/db/schema';
import { type NormalizedRole, checkPermission, permission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import {
  type AccessUser,
  assertInstanceProfileAccess,
  getCurrentProfileId,
  resolveAccessUserIds,
} from '../access';
import { assertUserByAuthId } from '../assert';
import { noActiveModerationFlag } from '../moderation/moderationVisibility';
import {
  type PhaseProposalSqlScope,
  getPhaseProposalSqlScope,
} from './getProposalsForPhase';
import type { ListProposalsInput } from './listProposals';

type InstanceScopeRow = Pick<
  typeof processInstances.$inferSelect,
  | 'id'
  | 'profileId'
  | 'ownerProfileId'
  | 'instanceData'
  | 'processId'
  | 'currentStateId'
>;

export interface ProposalListScope {
  /** Instance row reused by callers for template resolution and enrichment. */
  instance: InstanceScopeRow;
  currentProfileId: string | undefined;
  canManageProposals: boolean;
  profileRoles: NormalizedRole[];
  /**
   * True when the resolved scope can't match any proposal (unreached phase or
   * an empty category). Callers should short-circuit to an empty result.
   */
  isEmpty: boolean;
  /**
   * Builds the full WHERE clause for the resolved scope. Parameterized on the
   * table reference so it works for both the v2 relational `findMany` (aliased
   * table) and a plain `db.select().from(proposals)` count query.
   */
  buildWhereClause: (proposalsTable: typeof proposals) => SQL;
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

/**
 * Reviewer identity + phase for the `excludeAssignedForReview` anti-join. Both
 * are required together; absent means skip the exclusion.
 */
type ReviewAssignmentExclusion = {
  /** The reviewer's individual profile id (`users.profileId`). */
  reviewerProfileId: string;
  phaseId: string;
};

// Match the query literally — unescaped, `%` matches every title.
const escapeLikePattern = (value: string): string =>
  value.replace(/[\\%_]/g, (char) => `\\${char}`);

// One predicate per word, so the cap bounds the work a single query can ask for.
// Past it the extra words are dropped, which only widens an already-narrow match.
const MAX_SEARCH_WORDS = 10;

const splitSearchWords = (search: string | undefined): string[] =>
  (search ?? '').split(/\s+/).filter(Boolean).slice(0, MAX_SEARCH_WORDS);

// Shared function to build WHERE conditions for both count and data queries.
// Parameterized on the table reference so callers can pass either the schema
// table (for plain `db.select(...).from(proposals).where(...)`) or the
// relationally-aliased table from a v2 `RAW` callback. Both forms yield SQL
// that resolves to the right alias in their respective query contexts.
const buildBaseConditions = (
  t: typeof proposals,
  input: ListProposalsInput,
  reviewExclusion: ReviewAssignmentExclusion | undefined,
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

  const searchWords = splitSearchWords(search);
  if (searchWords.length > 0) {
    // Title lives in `profiles.name` (kept current by updateProposal's autosave).
    // `proposalData.title` is frozen at creation — collab-doc titles resolve from
    // a TipTap fragment — so matching the JSON would match dead titles.
    //
    // One substring match per word, ANDed: keeps `ike` finding "Bike" (which
    // full-text search can't, matching only from word starts) while making word
    // order irrelevant, which a single `%a b%` match can't.
    //
    // Postgres normalizes this EXISTS into a semi-join and picks the driving
    // side by cost, so both plans stay available: a 3+ character word goes
    // through `profiles_name_trgm_idx`, while 1-2 characters (too short for
    // pg_trgm to extract a trigram) drive from the phase-scoped proposals and
    // probe profiles by primary key. Both paths are already indexed.
    conditions.push(
      exists(
        db
          .select({ id: profiles.id })
          .from(profiles)
          .where(
            and(
              eq(profiles.id, t.profileId),
              ...searchWords.map((word) =>
                ilike(profiles.name, `%${escapeLikePattern(word)}%`),
              ),
            ),
          ),
      ),
    );
  }

  // "Other proposals" tab: exclude proposals the caller is assigned to review
  // in the viewed phase. Correlated anti-join matching the
  // (processInstanceId, proposalId, reviewerProfileId, phaseId) unique index.
  // Phase-scoped so a past-phase assignment can't hide the proposal now.
  if (reviewExclusion) {
    conditions.push(
      notExists(
        db
          .select({ id: proposalReviewAssignments.id })
          .from(proposalReviewAssignments)
          .where(
            and(
              eq(
                proposalReviewAssignments.processInstanceId,
                processInstanceId,
              ),
              eq(proposalReviewAssignments.proposalId, t.id),
              eq(
                proposalReviewAssignments.reviewerProfileId,
                reviewExclusion.reviewerProfileId,
              ),
              eq(proposalReviewAssignments.phaseId, reviewExclusion.phaseId),
            ),
          ),
      ),
    );
  }

  return and(...conditions)!;
};

/**
 * Resolves the shared access/phase/visibility/moderation scope for a proposal
 * list query. Both `listProposals` (paginated, enriched) and
 * `listProposalLocations` (all rows, slim) use this so their filtering — and
 * therefore what a viewer is allowed to see — can never diverge.
 */
export const resolveProposalListScope = async ({
  input,
  user,
}: {
  input: ListProposalsInput;
  // Narrow to the id the resolver actually reads — see `listProposals`.
  user: AccessUser | undefined;
}): Promise<ProposalListScope> => {
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

  // Resolve phase-scope SQL predicates for non-drafts and drafts. Drafts are
  // phase-scoped via a `createdAt` window since they're never attached to
  // transition snapshots. The scope helper resolves the phase window once and
  // returns predicate builders that fold the attachment-snapshot lookup and
  // the access subquery directly into the outer query — so the main
  // `findMany` and the parallel count share a single SQL plan instead of
  // bouncing hundreds of IDs through JS as bound params per page.
  //
  // Explicit-scope callers (`proposalIds` / `votedByProfileId`) bypass phase
  // resolution entirely and supply the exact ID set to constrain against.
  const phaseScopePromise: Promise<PhaseProposalSqlScope> = (async () => {
    if (explicitScopeIds !== undefined) {
      // Caller specified the exact ID set (proposalIds or votedByProfileId).
      // Drafts can't appear in either: proposalIds is internal and
      // votedByProfileId only matches submitted proposals on a ballot.
      const ids = explicitScopeIds;
      return {
        isEmpty: ids.length === 0,
        buildNonDraftFilter: (t) =>
          ids.length > 0
            ? and(isNull(t.deletedAt), inArray(t.id, ids))!
            : sql`false`,
        buildDraftFilter: () => sql`false`,
      };
    }
    return getPhaseProposalSqlScope({
      instance,
      phaseId: input.phaseId,
      // Trusted (`skipAccessCheck`) callers never surface drafts. The helper
      // still returns a draft predicate using an empty access set, but the
      // skipAccessCheck branch in `buildWhereClause` never references it.
      authUserIds: skipAccessCheck ? [] : accessUserIds,
    });
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

  const [phaseScope, { profileRoles, canManageProposals }] = await Promise.all([
    phaseScopePromise,
    accessPromise,
  ]);

  // Resolve category-scoped proposal IDs so the same ID set is available to
  // every query the caller builds from `buildWhereClause`.
  const { categoryId } = input;
  let categoryProposalIds: string[] = [];
  let categoryIsEmpty = false;

  if (categoryId) {
    const proposalIdsInCategory = await db
      .select({ proposalId: proposalCategories.proposalId })
      .from(proposalCategories)
      .where(eq(proposalCategories.taxonomyTermId, categoryId));

    categoryProposalIds = proposalIdsInCategory.map((p) => p.proposalId);
    categoryIsEmpty = categoryProposalIds.length === 0;
  }

  // Unreached phases on non-legacy instances surface zero rows from both the
  // non-draft and draft scopes; an empty category likewise can't match. Either
  // makes the whole scope empty, so callers should short-circuit.
  const isEmpty = phaseScope.isEmpty || categoryIsEmpty;

  // The phase being viewed — the "Other proposals" tab omits phaseId and
  // defaults to the instance's current state.
  const phaseId = input.phaseId ?? instance.currentStateId ?? undefined;

  // Reviewer + phase for the excludeAssignedForReview anti-join. Assignments are
  // keyed on the user's individual profile (users.profileId), resolved only when
  // the flag is set; profile-less callers skip the exclusion.
  let reviewExclusion: ReviewAssignmentExclusion | undefined;
  if (input.excludeAssignedForReview && user && phaseId) {
    const reviewer = await assertUserByAuthId(user.id).catch(() => null);
    if (reviewer?.profileId) {
      reviewExclusion = { reviewerProfileId: reviewer.profileId, phaseId };
    }
  }

  // Assemble the full WHERE clause. Parameterized on the table reference so
  // the same builder can be used for the v2 relational findMany (where Drizzle
  // passes an aliased `table`) and the plain count query (which passes the
  // schema table). See `buildBaseConditions` above for the same pattern.
  const buildWhereClause = (proposalsTable: typeof proposals): SQL => {
    let clause: SQL = buildBaseConditions(
      proposalsTable,
      input,
      reviewExclusion,
    );

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

    // Phase scoping is composed in SQL: non-drafts match the attachment
    // snapshot ∪ a strict `(inboundAt, outboundAt)` `createdAt` window, while
    // drafts match the half-open `[inboundAt, outboundAt)` window AND the
    // caller's `profileUsers` access set. Every scope predicate (including
    // the explicit-scope one above) carries the `isNull(deletedAt)` filter,
    // so the outer query stays soft-delete-safe without its own check.
    const phaseScopedNonDraftIdFilter = and(
      ne(proposalsTable.status, ProposalStatus.DRAFT),
      phaseScope.buildNonDraftFilter(proposalsTable),
    )!;

    if (skipAccessCheck) {
      // Trusted contexts get all phase-scoped non-draft proposals.
      return and(clause, phaseScopedNonDraftIdFilter)!;
    }

    // Draft proposals are phase-scoped to their `createdAt` window: a draft
    // made in Phase 1 is only visible when viewing Phase 1, even after the
    // instance advances. Ownership scoping (creator + invited collaborators
    // via `profileUsers`) is applied inside `getPhaseProposalSqlScope` via
    // a subquery, so the draft filter is already access-filtered — no further
    // ownership filter is needed here.
    const draftFilter = and(
      eq(proposalsTable.status, ProposalStatus.DRAFT),
      phaseScope.buildDraftFilter(proposalsTable),
    )!;

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

  return {
    instance,
    currentProfileId,
    canManageProposals,
    profileRoles,
    isEmpty,
    buildWhereClause,
  };
};
