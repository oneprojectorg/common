import {
  type DbClient,
  type SQL,
  and,
  asc,
  db as defaultDb,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  ne,
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
  const [inbound] = await db
    .select({
      id: stateTransitionHistory.id,
      transitionedAt: stateTransitionHistory.transitionedAt,
    })
    .from(stateTransitionHistory)
    .where(
      and(
        eq(stateTransitionHistory.processInstanceId, instanceId),
        eq(stateTransitionHistory.toStateId, phaseId),
      ),
    )
    .orderBy(desc(stateTransitionHistory.transitionedAt))
    .limit(1);

  const [outbound] = await db
    .select({ transitionedAt: stateTransitionHistory.transitionedAt })
    .from(stateTransitionHistory)
    .where(
      and(
        eq(stateTransitionHistory.processInstanceId, instanceId),
        eq(stateTransitionHistory.fromStateId, phaseId),
        ...(inbound
          ? [gt(stateTransitionHistory.transitionedAt, inbound.transitionedAt)]
          : []),
      ),
    )
    .orderBy(asc(stateTransitionHistory.transitionedAt))
    .limit(1);

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
        ne(proposals.status, ProposalStatus.DRAFT),
        isNull(proposals.deletedAt),
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
      ),
    );
  return rows.map((r) => r.id);
}

/**
 * Returns IDs of all active (non-deleted) non-draft proposals for an instance,
 * ignoring phase scoping. Use this for legacy instances or when the caller
 * has decided not to apply phase scoping (e.g. instance has no current phase).
 */
async function getActiveNonDraftIdsForInstance({
  instanceId,
  db = defaultDb,
}: {
  instanceId: string;
  db?: DbClient;
}): Promise<string[]> {
  return getActiveIdsByPredicate({
    instanceId,
    predicate: ne(proposals.status, ProposalStatus.DRAFT),
    db,
  });
}

/**
 * Returns IDs of non-draft proposals visible in the given phase.
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
    return getActiveNonDraftIdsForInstance({ instanceId, db });
  }

  const nonDraftPredicate = ne(proposals.status, ProposalStatus.DRAFT);

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
        predicate: nonDraftPredicate,
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
  authUserId,
  db = defaultDb,
}: {
  instance: PhaseScopedInstance;
  phaseId?: string;
  authUserId: string;
  db?: DbClient;
}): Promise<{ nonDraftIds: string[]; draftIds: string[] }> {
  const ctx = deriveInstanceContext(instance);
  const instanceId = instance.id;

  const nonDraftPredicate = ne(proposals.status, ProposalStatus.DRAFT);
  const draftAccessPredicate = and(
    eq(proposals.status, ProposalStatus.DRAFT),
    inArray(
      proposals.profileId,
      db
        .select({ profileId: profileUsers.profileId })
        .from(profileUsers)
        .where(eq(profileUsers.authUserId, authUserId)),
    ),
  );

  const resolvedPhaseId = ctx.isLegacy
    ? undefined
    : (phaseId ?? ctx.currentPhaseId);

  if (!resolvedPhaseId) {
    const [nonDraftIds, draftIds] = await Promise.all([
      getActiveIdsByPredicate({
        instanceId,
        predicate: nonDraftPredicate,
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
      predicate: nonDraftPredicate,
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
