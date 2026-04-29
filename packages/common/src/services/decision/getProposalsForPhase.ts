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
 * Loads the instance's legacy/current-phase context in a single query.
 * Returns null if the instance does not exist.
 */
async function getInstanceContext(
  instanceId: string,
  db: DbClient,
): Promise<{ isLegacy: boolean; currentPhaseId?: string | null } | null> {
  const [row] = await db
    .select({
      instanceData: processInstances.instanceData,
      currentStateId: processInstances.currentStateId,
    })
    .from(processInstances)
    .where(eq(processInstances.id, instanceId))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    isLegacy: isLegacyInstanceData(row.instanceData),
    currentPhaseId: row.currentStateId,
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
 * Returns IDs of non-draft proposals visible in the given phase.
 *
 * A proposal is in phase P iff it was attached to P's inbound transition
 * (survived the advance-in snapshot) OR it was submitted during P's window
 * (between advance-in and advance-out, or between advance-in and now for the
 * current phase).
 *
 * Non-drafts use a strict `(inboundAt, outboundAt)` window because the inbound
 * boundary is covered by attachment snapshots. For drafts, use the sibling
 * `getDraftIdsForPhase`, which applies a half-open `[inboundAt, outboundAt)`
 * window since drafts have no attachment branch.
 *
 * - Legacy instances (no phases array in instanceData): returns all active
 *   non-draft proposals; phase scoping does not apply.
 * - Unreached phase (phaseId refers to a phase the instance hasn't entered):
 *   returns [].
 */
export async function getProposalIdsForPhase({
  instanceId,
  phaseId,
  db = defaultDb,
}: {
  instanceId: string;
  phaseId?: string;
  db?: DbClient;
}): Promise<string[]> {
  const ctx = await getInstanceContext(instanceId, db);

  if (!ctx) {
    return [];
  }

  const nonDraftPredicate = ne(proposals.status, ProposalStatus.DRAFT);

  if (ctx.isLegacy) {
    return getActiveIdsByPredicate({
      instanceId,
      predicate: nonDraftPredicate,
      db,
    });
  }

  const resolvedPhaseId = phaseId ?? ctx.currentPhaseId;
  if (!resolvedPhaseId) {
    return getActiveIdsByPredicate({
      instanceId,
      predicate: nonDraftPredicate,
      db,
    });
  }

  const window = await resolvePhaseWindow(
    instanceId,
    resolvedPhaseId,
    ctx.currentPhaseId,
    db,
  );

  if (window.kind === 'unreached') {
    return [];
  }

  const attachmentIds = window.inbound
    ? await attachmentIdsFor(window.inbound.id, db)
    : [];

  const duringIds = await getIdsCreatedDuringWindow({
    instanceId,
    predicate: nonDraftPredicate,
    inboundAt: window.inbound?.transitionedAt,
    outboundAt: window.outboundTransitionedAt,
    inboundComparator: 'gt',
    db,
  });

  return [...new Set([...attachmentIds, ...duringIds])];
}

/**
 * Returns IDs of draft proposals attributable to the given phase, scoped to
 * drafts the caller can access (creators and collaborators on the proposal's
 * profile, via `profileUsers`).
 *
 * A draft belongs to phase P iff its `createdAt` falls inside P's
 * half-open `[inboundAt, outboundAt)` window. Drafts are never attached to
 * transitions, so only the temporal branch applies. The half-open window
 * (vs. the strict window used for non-drafts) ensures that a draft created
 * exactly at a transition boundary lands in the post-transition phase.
 *
 * The ownership filter is pushed into the SQL query (via a `profileUsers`
 * subquery on `authUserId`) rather than applied after fetching, so we never
 * load drafts the caller has no access to. This matters at scale: an instance
 * may accumulate hundreds of thousands of drafts across users.
 *
 * - Legacy instances: returns all active drafts the caller can access; phase
 *   scoping does not apply.
 * - Unreached phase: returns [].
 */
export async function getDraftIdsForPhase({
  instanceId,
  phaseId,
  authUserId,
  db = defaultDb,
}: {
  instanceId: string;
  phaseId?: string;
  authUserId: string;
  db?: DbClient;
}): Promise<string[]> {
  const ctx = await getInstanceContext(instanceId, db);

  if (!ctx) {
    return [];
  }

  // Compose the draft + ownership filter into a single predicate. Pushing the
  // `profileUsers` ownership subquery into SQL ensures we never load drafts
  // the caller has no access to — important at scale, where instances may
  // accumulate hundreds of thousands of drafts across users.
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

  if (ctx.isLegacy) {
    return getActiveIdsByPredicate({
      instanceId,
      predicate: draftAccessPredicate,
      db,
    });
  }

  const resolvedPhaseId = phaseId ?? ctx.currentPhaseId;
  if (!resolvedPhaseId) {
    return getActiveIdsByPredicate({
      instanceId,
      predicate: draftAccessPredicate,
      db,
    });
  }

  const window = await resolvePhaseWindow(
    instanceId,
    resolvedPhaseId,
    ctx.currentPhaseId,
    db,
  );

  if (window.kind === 'unreached') {
    return [];
  }

  return getIdsCreatedDuringWindow({
    instanceId,
    predicate: draftAccessPredicate,
    inboundAt: window.inbound?.transitionedAt,
    outboundAt: window.outboundTransitionedAt,
    inboundComparator: 'gte',
    db,
  });
}

/**
 * Returns the proposals visible in the given phase. See `getProposalIdsForPhase`
 * for membership semantics.
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
  const ids = await getProposalIdsForPhase({ instanceId, phaseId, db });
  if (ids.length === 0) {
    return [];
  }

  return db
    .select()
    .from(proposals)
    .where(inArray(proposals.id, ids))
    .orderBy(desc(proposals.createdAt));
}
