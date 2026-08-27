import {
  type DbClient,
  type SQL,
  and,
  db as defaultDb,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  notInArray,
  or,
  sql,
} from '@op/db/client';
import type { Proposal } from '@op/db/schema';
import {
  ProposalStatus,
  decisionTransitionProposals,
  processInstances,
  profileUsers,
  proposals,
  stateTransitionHistory,
} from '@op/db/schema';

import { isLegacyInstanceData } from './isLegacyInstance';
import { notSuperseded } from './proposalSupersession';
import { PIPELINE_INELIGIBLE_STATUSES } from './votingEligibility';

/**
 * Excludes drafts (never in a phase), rejected proposals, and superseded
 * proposals. Every selection, review, and results path resolves membership
 * through this file, so this is what keeps them out of all of them — and since
 * the proposal list stopped filtering on rejection
 * (`resolveProposalListScope`), it is the *only* thing that does. A rejected
 * proposal is listed and readable by everyone; what it no longer does is
 * advance, get reviewed, or be voted on.
 */
const phaseEligiblePredicate = (t: typeof proposals): SQL =>
  and(
    notInArray(t.status, PIPELINE_INELIGIBLE_STATUSES),
    notSuperseded({
      proposalId: t.id,
      processInstanceId: t.processInstanceId,
    }),
  )!;

/**
 * Minimal `processInstances` row shape required by the phase resolvers.
 * Callers must pre-fetch these fields rather than passing only an ID — this
 * forces them to make better decisions about data fetching (typically the
 * row is already loaded for access checks).
 */
export type PhaseScopedInstance = {
  id: string;
  instanceData: unknown;
  currentStateId: string | null;
};

type InstanceContext = {
  isLegacy: boolean;
  currentPhaseId: string | null;
};

function deriveInstanceContext(instance: PhaseScopedInstance): InstanceContext {
  return {
    isLegacy: isLegacyInstanceData(instance.instanceData),
    currentPhaseId: instance.currentStateId,
  };
}

type PhaseWindow =
  | { kind: 'unreached' }
  | {
      kind: 'visited';
      inbound?: { id: string; transitionedAt: Date };
      outboundTransitionedAt?: Date;
    };

/**
 * Resolves the temporal window for a phase within an instance.
 *
 * - `unreached`: instance has not visited this phase yet.
 * - `visited`: phase is current or past.
 *   - `inbound` is the most recent transition INTO the phase (undefined for the
 *     initial phase, which never has an inbound row).
 *   - `outboundTransitionedAt` is when the instance left the phase (undefined
 *     for the current phase).
 */
async function resolvePhaseWindow(
  instanceId: string,
  phaseId: string,
  currentPhaseId: string | null | undefined,
  db: DbClient,
): Promise<PhaseWindow> {
  // One round trip for every transition touching the phase (an instance has
  // few transitions per phase), resolved in JS: inbound is the most recent
  // transition INTO the phase, outbound the earliest transition OUT strictly
  // after it — the same rows the previous two sequential queries selected.
  const transitions = await db
    .select({
      id: stateTransitionHistory.id,
      transitionedAt: stateTransitionHistory.transitionedAt,
      toStateId: stateTransitionHistory.toStateId,
      fromStateId: stateTransitionHistory.fromStateId,
    })
    .from(stateTransitionHistory)
    .where(
      and(
        eq(stateTransitionHistory.processInstanceId, instanceId),
        or(
          eq(stateTransitionHistory.toStateId, phaseId),
          eq(stateTransitionHistory.fromStateId, phaseId),
        ),
      ),
    );

  let inbound: { id: string; transitionedAt: Date } | undefined;
  for (const transition of transitions) {
    if (
      transition.toStateId === phaseId &&
      (!inbound || transition.transitionedAt > inbound.transitionedAt)
    ) {
      inbound = transition;
    }
  }

  let outbound: { transitionedAt: Date } | undefined;
  for (const transition of transitions) {
    if (transition.fromStateId !== phaseId) {
      continue;
    }
    if (inbound && transition.transitionedAt <= inbound.transitionedAt) {
      continue;
    }
    if (!outbound || transition.transitionedAt < outbound.transitionedAt) {
      outbound = transition;
    }
  }

  if (!inbound && !outbound) {
    // No transitions reference this phase. It's either the current initial
    // phase (never transitioned) or a phase the instance hasn't reached yet.
    if (phaseId === currentPhaseId) {
      return { kind: 'visited' };
    }
    return { kind: 'unreached' };
  }

  return {
    kind: 'visited',
    inbound: inbound ?? undefined,
    outboundTransitionedAt: outbound?.transitionedAt,
  };
}

/** Proposal ids attached to a specific inbound transition, filtered to still-active rows. */
async function attachmentIdsFor(
  transitionHistoryId: string,
  db: DbClient,
): Promise<string[]> {
  const rows = await db
    .select({ id: decisionTransitionProposals.proposalId })
    .from(decisionTransitionProposals)
    .innerJoin(
      proposals,
      eq(decisionTransitionProposals.proposalId, proposals.id),
    )
    .where(
      and(
        eq(
          decisionTransitionProposals.transitionHistoryId,
          transitionHistoryId,
        ),
        phaseEligiblePredicate(proposals),
        isNull(proposals.deletedAt),
        isNull(proposals.moderationDetachedAt),
      ),
    );
  return rows.map((r) => r.id);
}

/**
 * Proposal ids matching `predicate` whose `createdAt` falls inside the
 * phase's transition window. The inbound comparator (`'gt'` or `'gte'`) lets
 * callers choose strict or half-open semantics: non-drafts use `'gt'` because
 * the inbound boundary is covered by attachment snapshots, while drafts use
 * `'gte'` to ensure boundary timestamps land in exactly one phase. Callers
 * compose multiple constraints into a single `predicate` via `and(...)`.
 */
async function getIdsCreatedDuringWindow({
  instanceId,
  predicate,
  inboundAt,
  outboundAt,
  inboundComparator,
  db,
}: {
  instanceId: string;
  predicate: SQL | undefined;
  inboundAt: Date | undefined;
  outboundAt: Date | undefined;
  inboundComparator: 'gt' | 'gte';
  db: DbClient;
}): Promise<string[]> {
  const conditions: (SQL | undefined)[] = [
    eq(proposals.processInstanceId, instanceId),
    predicate,
    isNull(proposals.deletedAt),
    // Moderation-detached (CSAM) rows are invisible to every downstream
    // caller — including trusted admin views — so the ID set can never
    // surface them via a phase-scoped lookup.
    isNull(proposals.moderationDetachedAt),
  ];
  if (inboundAt) {
    const comparator = inboundComparator === 'gte' ? gte : gt;
    conditions.push(comparator(proposals.createdAt, inboundAt.toISOString()));
  }
  if (outboundAt) {
    conditions.push(lt(proposals.createdAt, outboundAt.toISOString()));
  }

  const rows = await db
    .select({ id: proposals.id })
    .from(proposals)
    .where(and(...conditions));
  return rows.map((r) => r.id);
}

async function getActiveIdsByPredicate({
  instanceId,
  predicate,
  db,
}: {
  instanceId: string;
  predicate: SQL | undefined;
  db: DbClient;
}): Promise<string[]> {
  const rows = await db
    .select({ id: proposals.id })
    .from(proposals)
    .where(
      and(
        eq(proposals.processInstanceId, instanceId),
        predicate,
        isNull(proposals.deletedAt),
        isNull(proposals.moderationDetachedAt),
      ),
    );
  return rows.map((r) => r.id);
}

/**
 * Returns IDs of all active (non-deleted) phase-eligible proposals for an
 * instance, ignoring phase scoping. Use this for legacy instances or when the
 * caller has decided not to apply phase scoping (e.g. instance has no current
 * phase).
 */
async function getActivePhaseEligibleIdsForInstance({
  instanceId,
  db = defaultDb,
}: {
  instanceId: string;
  db?: DbClient;
}): Promise<string[]> {
  return getActiveIdsByPredicate({
    instanceId,
    predicate: phaseEligiblePredicate(proposals),
    db,
  });
}

/**
 * Returns IDs of non-draft proposals visible in the given phase. "Non-draft"
 * here means phase-eligible — see {@link phaseEligiblePredicate}, which also
 * drops merged proposals.
 *
 * A proposal is in phase P iff it was attached to P's inbound transition
 * (survived the advance-in snapshot) OR it was submitted during P's window
 * (between advance-in and advance-out, or between advance-in and now for the
 * current phase).
 *
 * Non-drafts use a strict `(inboundAt, outboundAt)` window because the inbound
 * boundary is covered by attachment snapshots. For drafts, use the sibling
 * `getPhaseProposalAndDraftIds`, which applies a half-open
 * `[inboundAt, outboundAt)` window since drafts have no attachment branch.
 *
 * Legacy instances and instances without a resolvable phase (no `phaseId`
 * passed and no `currentStateId` on the instance) skip phase scoping and
 * return all active non-drafts. In particular, legacy instances bypass the
 * unreached-phase check entirely — any `phaseId` is ignored.
 *
 * Returns [] for an unreached phase (a phase the instance hasn't entered)
 * on non-legacy instances.
 */
export async function getProposalIdsForPhase({
  instance,
  phaseId,
  db = defaultDb,
}: {
  instance: PhaseScopedInstance;
  phaseId?: string;
  db?: DbClient;
}): Promise<string[]> {
  const ctx = deriveInstanceContext(instance);
  const instanceId = instance.id;
  const resolvedPhaseId = ctx.isLegacy
    ? undefined
    : (phaseId ?? ctx.currentPhaseId);

  if (!resolvedPhaseId) {
    return getActivePhaseEligibleIdsForInstance({ instanceId, db });
  }

  const phaseEligible = phaseEligiblePredicate(proposals);

  const phaseWindow = await resolvePhaseWindow(
    instanceId,
    resolvedPhaseId,
    ctx.currentPhaseId,
    db,
  );

  if (phaseWindow.kind === 'unreached') {
    return [];
  }

  const [proposalIdsAttachedToPhase, nonDraftProposalIdsCreatedInPhase] =
    await Promise.all([
      phaseWindow.inbound
        ? attachmentIdsFor(phaseWindow.inbound.id, db)
        : Promise.resolve<string[]>([]),
      getIdsCreatedDuringWindow({
        instanceId,
        predicate: phaseEligible,
        inboundAt: phaseWindow.inbound?.transitionedAt,
        outboundAt: phaseWindow.outboundTransitionedAt,
        inboundComparator: 'gt',
        db,
      }),
    ]);

  return [
    ...new Set([
      ...proposalIdsAttachedToPhase,
      ...nonDraftProposalIdsCreatedInPhase,
    ]),
  ];
}

/**
 * Returns both the non-draft and draft IDs visible in a phase for an
 * authenticated caller, sharing a single phase-window resolution across
 * both queries. Use this from `listProposals` (which needs both sets)
 * instead of calling the standalone resolvers separately, which would
 * issue duplicate `stateTransitionHistory` reads.
 *
 * Non-drafts are scoped via attachment snapshots + a strict `(inboundAt,
 * outboundAt)` window. Drafts use a half-open `[inboundAt, outboundAt)` window
 * (so a draft created at a transition timestamp lands in the post-transition
 * phase) and are filtered to ones the caller can access — creators and
 * collaborators on the proposal's profile, via a `profileUsers` subquery
 * pushed into SQL. The pushdown matters at scale, where an instance may
 * accumulate hundreds of thousands of drafts across users.
 *
 * - Legacy instances: returns all active non-drafts and all accessible drafts;
 *   phase scoping does not apply (any `phaseId` is ignored).
 * - Unreached phase (non-legacy only): returns empty arrays for both.
 */
export async function getPhaseProposalAndDraftIds({
  instance,
  phaseId,
  authUserIds,
  db = defaultDb,
}: {
  instance: PhaseScopedInstance;
  phaseId?: string;
  authUserIds: string[];
  db?: DbClient;
}): Promise<{ nonDraftIds: string[]; draftIds: string[] }> {
  const ctx = deriveInstanceContext(instance);
  const instanceId = instance.id;

  const phaseEligible = phaseEligiblePredicate(proposals);
  const draftAccessPredicate = and(
    eq(proposals.status, ProposalStatus.DRAFT),
    inArray(
      proposals.profileId,
      db
        .select({ profileId: profileUsers.profileId })
        .from(profileUsers)
        .where(inArray(profileUsers.authUserId, authUserIds)),
    ),
  );

  const resolvedPhaseId = ctx.isLegacy
    ? undefined
    : (phaseId ?? ctx.currentPhaseId);

  if (!resolvedPhaseId) {
    const [nonDraftIds, draftIds] = await Promise.all([
      getActiveIdsByPredicate({
        instanceId,
        predicate: phaseEligible,
        db,
      }),
      getActiveIdsByPredicate({
        instanceId,
        predicate: draftAccessPredicate,
        db,
      }),
    ]);
    return { nonDraftIds, draftIds };
  }

  const phaseWindow = await resolvePhaseWindow(
    instanceId,
    resolvedPhaseId,
    ctx.currentPhaseId,
    db,
  );

  if (phaseWindow.kind === 'unreached') {
    return { nonDraftIds: [], draftIds: [] };
  }

  const [
    proposalIdsAttachedToPhase,
    nonDraftProposalIdsCreatedInPhase,
    draftProposalIdsCreatedInPhase,
  ] = await Promise.all([
    phaseWindow.inbound
      ? attachmentIdsFor(phaseWindow.inbound.id, db)
      : Promise.resolve<string[]>([]),
    getIdsCreatedDuringWindow({
      instanceId,
      predicate: phaseEligible,
      inboundAt: phaseWindow.inbound?.transitionedAt,
      outboundAt: phaseWindow.outboundTransitionedAt,
      inboundComparator: 'gt',
      db,
    }),
    getIdsCreatedDuringWindow({
      instanceId,
      predicate: draftAccessPredicate,
      inboundAt: phaseWindow.inbound?.transitionedAt,
      outboundAt: phaseWindow.outboundTransitionedAt,
      inboundComparator: 'gte',
      db,
    }),
  ]);

  return {
    nonDraftIds: [
      ...new Set([
        ...proposalIdsAttachedToPhase,
        ...nonDraftProposalIdsCreatedInPhase,
      ]),
    ],
    draftIds: draftProposalIdsCreatedInPhase,
  };
}

/**
 * SQL-side equivalent of `getPhaseProposalAndDraftIds` for hot-path callers
 * (notably `listProposals`) that want to avoid materializing two large JS
 * arrays of proposal IDs and bouncing them back into the database as bound
 * params. Returns builder functions that produce SQL predicates against the
 * outer `proposals` row (aliased or not), so the attachment-snapshot lookup
 * and the created-in-window predicate become inline subqueries / OR fragments
 * inside the caller's query instead of standalone round-trips.
 *
 * The phase-window resolution itself still runs in JS (one or two
 * `stateTransitionHistory` reads on indexed columns — bounded and cheap), so
 * `decisionTransitionProposals` and the per-instance `profileUsers` access
 * subquery are the only joins pushed down.
 *
 * Semantics match `getPhaseProposalAndDraftIds`:
 * - Legacy / no-current-phase: predicates allow all non-drafts and all
 *   accessible drafts for the instance (phase scoping disabled).
 * - Unreached phase: both predicates short-circuit to `sql\`false\`` and
 *   `isEmpty` is true so callers can skip the query entirely.
 * - Otherwise: non-drafts match the attachment snapshot ∪ a strict
 *   `(inboundAt, outboundAt)` `createdAt` window; drafts match the half-open
 *   `[inboundAt, outboundAt)` window AND the caller's `profileUsers`
 *   access set.
 *
 * Soft-deleted proposals (`deletedAt IS NOT NULL`) are excluded by every
 * predicate this returns, matching the helpers it replaces — so callers do
 * not need to add their own `isNull(deletedAt)` filter when consuming these
 * predicates.
 */
export type PhaseProposalSqlScope = {
  /**
   * True iff the phase is unreached on a non-legacy instance — both
   * predicates resolve to `sql\`false\`` and the caller can return an empty
   * result without running the main query.
   */
  isEmpty: boolean;
  /**
   * Predicate matching non-draft proposals visible in this phase. Carries no
   * status or supersession filter of its own, so the caller owns both
   * (`resolveProposalListScope` does).
   */
  buildNonDraftFilter: (t: typeof proposals) => SQL;
  /**
   * Predicate matching draft proposals visible to the caller in this phase.
   * Composes with the outer query's `processInstanceId = X` filter — the
   * predicate itself adds the `profileUsers` access subquery and the
   * draft-side half-open `createdAt` window.
   */
  buildDraftFilter: (t: typeof proposals) => SQL;
};

export async function getPhaseProposalSqlScope({
  instance,
  phaseId,
  authUserIds,
  db = defaultDb,
}: {
  instance: PhaseScopedInstance;
  phaseId?: string;
  authUserIds: string[];
  db?: DbClient;
}): Promise<PhaseProposalSqlScope> {
  const ctx = deriveInstanceContext(instance);
  const resolvedPhaseId = ctx.isLegacy
    ? undefined
    : (phaseId ?? ctx.currentPhaseId);

  const buildDraftAccessFilter = (t: typeof proposals): SQL =>
    inArray(
      t.profileId,
      db
        .select({ profileId: profileUsers.profileId })
        .from(profileUsers)
        .where(inArray(profileUsers.authUserId, authUserIds)),
    );

  if (!resolvedPhaseId) {
    // Legacy / no-current-phase: no phase scoping. Match all in-instance,
    // non-deleted rows on each side. The outer query already constrains
    // `processInstanceId`, so the predicates only add the deletion filter
    // (plus access scoping for drafts).
    return {
      isEmpty: false,
      buildNonDraftFilter: (t) => isNull(t.deletedAt),
      buildDraftFilter: (t) =>
        and(isNull(t.deletedAt), buildDraftAccessFilter(t))!,
    };
  }

  const phaseWindow = await resolvePhaseWindow(
    instance.id,
    resolvedPhaseId,
    ctx.currentPhaseId,
    db,
  );

  if (phaseWindow.kind === 'unreached') {
    return {
      isEmpty: true,
      buildNonDraftFilter: () => sql`false`,
      buildDraftFilter: () => sql`false`,
    };
  }

  const inboundTransitionId = phaseWindow.inbound?.id;
  const inboundAt = phaseWindow.inbound?.transitionedAt;
  const outboundAt = phaseWindow.outboundTransitionedAt;

  const buildNonDraftWindowFilter = (t: typeof proposals): SQL | undefined =>
    inboundAt || outboundAt
      ? and(
          inboundAt ? gt(t.createdAt, inboundAt.toISOString()) : undefined,
          outboundAt ? lt(t.createdAt, outboundAt.toISOString()) : undefined,
        )!
      : undefined;

  // Attachment-snapshot membership is delegated to a subquery so the outer
  // query doesn't have to materialize the (potentially hundreds of) IDs from
  // `decision_transition_proposals`. `transition_history_id` is indexed, so
  // the lookup is a single index scan per query.
  const buildAttachmentInFilter = (t: typeof proposals): SQL | undefined =>
    inboundTransitionId
      ? inArray(
          t.id,
          db
            .select({ id: decisionTransitionProposals.proposalId })
            .from(decisionTransitionProposals)
            .where(
              eq(
                decisionTransitionProposals.transitionHistoryId,
                inboundTransitionId,
              ),
            ),
        )
      : undefined;

  return {
    isEmpty: false,
    buildNonDraftFilter: (t) =>
      and(
        // Soft-deleted rows are excluded from both the attachment-snapshot
        // branch and the window branch (the helpers we used to call applied
        // this filter pre-IN-list).
        isNull(t.deletedAt),
        // `or(...)` filters out undefined; when both branches are undefined
        // (initial phase with no transitions) the predicate reduces to just
        // the deletion filter — matching every in-instance non-deleted row.
        or(buildAttachmentInFilter(t), buildNonDraftWindowFilter(t)),
      )!,
    buildDraftFilter: (t) =>
      and(
        isNull(t.deletedAt),
        buildDraftAccessFilter(t),
        inboundAt ? gte(t.createdAt, inboundAt.toISOString()) : undefined,
        outboundAt ? lt(t.createdAt, outboundAt.toISOString()) : undefined,
      )!,
  };
}

/**
 * Returns the proposals visible in the given phase. See `getProposalIdsForPhase`
 * for membership semantics. Defaults to the instance's current phase when
 * `phaseId` is omitted and falls back to all active non-drafts for legacy
 * instances or instances without a current phase.
 */
export async function getProposalsForPhase({
  instanceId,
  phaseId,
  db = defaultDb,
}: {
  instanceId: string;
  phaseId?: string;
  db?: DbClient;
}): Promise<Proposal[]> {
  const [instance] = await db
    .select({
      id: processInstances.id,
      instanceData: processInstances.instanceData,
      currentStateId: processInstances.currentStateId,
    })
    .from(processInstances)
    .where(eq(processInstances.id, instanceId))
    .limit(1);

  if (!instance) {
    return [];
  }

  const ids = await getProposalIdsForPhase({ instance, phaseId, db });

  if (ids.length === 0) {
    return [];
  }

  return db
    .select()
    .from(proposals)
    .where(inArray(proposals.id, ids))
    .orderBy(desc(proposals.createdAt));
}
