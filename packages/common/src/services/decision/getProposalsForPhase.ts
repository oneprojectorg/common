import {
  type DbClient,
  and,
  asc,
  db as defaultDb,
  desc,
  eq,
  gt,
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

/** Proposal ids with `createdAt` strictly between the phase's transition-in and transition-out timestamps. */
async function submittedDuringIds(
  instanceId: string,
  inboundAt: Date | undefined,
  outboundAt: Date | undefined,
  db: DbClient,
): Promise<string[]> {
  const conditions = [
    eq(proposals.processInstanceId, instanceId),
    ne(proposals.status, ProposalStatus.DRAFT),
    isNull(proposals.deletedAt),
  ];
  if (inboundAt) {
    conditions.push(gt(proposals.createdAt, inboundAt.toISOString()));
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

async function allActiveIds(
  instanceId: string,
  db: DbClient,
): Promise<string[]> {
  const rows = await db
    .select({ id: proposals.id })
    .from(proposals)
    .where(
      and(
        eq(proposals.processInstanceId, instanceId),
        ne(proposals.status, ProposalStatus.DRAFT),
        isNull(proposals.deletedAt),
      ),
    );
  return rows.map((r) => r.id);
}

/**
 * Returns IDs of proposals visible in the given phase.
 *
 * A proposal is in phase P iff it was attached to P's inbound transition
 * (survived the advance-in snapshot) OR it was submitted during P's window
 * (between advance-in and advance-out, or between advance-in and now for the
 * current phase).
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

  if (ctx.isLegacy) {
    return allActiveIds(instanceId, db);
  }

  const resolvedPhaseId = phaseId ?? ctx.currentPhaseId;
  if (!resolvedPhaseId) {
    return allActiveIds(instanceId, db);
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

  const duringIds = await submittedDuringIds(
    instanceId,
    window.inbound?.transitionedAt,
    window.outboundTransitionedAt,
    db,
  );

  return [...new Set([...attachmentIds, ...duringIds])];
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
