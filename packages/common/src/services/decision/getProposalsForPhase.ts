import {
  type DbClient,
  type SQL,
  and,
  asc,
  db as defaultDb,
  desc,
  eq,
  exists,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  ne,
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

/**
 * The instance-relative scope a query should apply to find proposals visible
 * in a phase.
 *
 * - `noPhase`: legacy instance or no resolvable phase. Phase membership is
 *   not enforced; callers fall back to status + soft-delete filters only.
 * - `unreached`: the instance has not entered this phase. The query must
 *   return zero rows.
 * - `visited`: phase is current or past. The query uses `inboundTransitionId`
 *   (attachment EXISTS) ORed with the `[inboundAt, outboundAt)` `createdAt`
 *   window — see `buildPhaseScopeSql`.
 */
export type PhaseScope =
  | { kind: 'noPhase' }
  | { kind: 'unreached' }
  | {
      kind: 'visited';
      inboundTransitionId: string | undefined;
      inboundAt: Date | undefined;
      outboundAt: Date | undefined;
    };

/**
 * Resolves phase membership info once per request, in a single (bounded)
 * `stateTransitionHistory` read. The returned scope is consumed by
 * `buildPhaseScopeSql` to produce an SQL predicate that can be applied
 * directly to a proposals query — no proposal-id materialization required.
 *
 * Legacy instances and instances without a resolvable phase (no `phaseId`
 * passed and no `currentStateId` on the instance) skip phase scoping and
 * return `{ kind: 'noPhase' }`.
 */
export async function resolvePhaseScope({
  instance,
  phaseId,
  db = defaultDb,
}: {
  instance: PhaseScopedInstance;
  phaseId?: string;
  db?: DbClient;
}): Promise<PhaseScope> {
  const ctx = deriveInstanceContext(instance);
  const resolvedPhaseId = ctx.isLegacy
    ? undefined
    : (phaseId ?? ctx.currentPhaseId);

  if (!resolvedPhaseId) {
    return { kind: 'noPhase' };
  }

  const phaseWindow = await resolvePhaseWindow(
    instance.id,
    resolvedPhaseId,
    ctx.currentPhaseId,
    db,
  );

  if (phaseWindow.kind === 'unreached') {
    return { kind: 'unreached' };
  }

  return {
    kind: 'visited',
    inboundTransitionId: phaseWindow.inbound?.id,
    inboundAt: phaseWindow.inbound?.transitionedAt,
    outboundAt: phaseWindow.outboundTransitionedAt,
  };
}

/**
 * SQL predicate that scopes a `proposals` query to a phase. Returns a
 * standalone clause to be ANDed with the caller's `processInstanceId` and
 * `deletedAt IS NULL` predicates — kept separate so callers can compose with
 * additional filters (visibility, moderation, access) without duplicating
 * phase logic.
 *
 * - `variant: 'nonDraft'` → `status != DRAFT AND ((EXISTS attachment) OR
 *   createdAt ∈ (inboundAt, outboundAt))`. Non-drafts use strict `>` at the
 *   inbound boundary because the attachment snapshot already covers it.
 * - `variant: 'draft'` → `status == DRAFT AND createdAt ∈ [inboundAt,
 *   outboundAt)`. Drafts have no attachment branch, so the inbound
 *   comparator is `>=` to ensure boundary timestamps land in exactly one
 *   phase. Access scoping (creator + collaborators) is the caller's
 *   responsibility — apply it via `profileUsers` subquery.
 *
 * Pass the aliased proposals table reference for the v2 relational `RAW`
 * callback, or the schema `proposals` table for plain queries. The same
 * helper produces SQL that resolves to the right alias in either context.
 */
export function buildPhaseScopeSql({
  t,
  scope,
  variant,
}: {
  t: typeof proposals;
  scope: PhaseScope;
  variant: 'nonDraft' | 'draft';
}): SQL {
  if (scope.kind === 'unreached') {
    return sql`false`;
  }

  const statusFilter =
    variant === 'nonDraft'
      ? ne(t.status, ProposalStatus.DRAFT)
      : eq(t.status, ProposalStatus.DRAFT);

  if (scope.kind === 'noPhase') {
    // Legacy / no-phase: status filter only.
    return statusFilter;
  }

  const { inboundTransitionId, inboundAt, outboundAt } = scope;
  const inboundComparator = variant === 'nonDraft' ? gt : gte;

  const windowConditions: SQL[] = [];
  if (inboundAt) {
    windowConditions.push(
      inboundComparator(t.createdAt, inboundAt.toISOString()),
    );
  }
  if (outboundAt) {
    windowConditions.push(lt(t.createdAt, outboundAt.toISOString()));
  }
  const windowSql: SQL =
    windowConditions.length > 0 ? and(...windowConditions)! : sql`true`;

  if (variant === 'draft') {
    return and(statusFilter, windowSql)!;
  }

  // Non-drafts: attachment EXISTS (when an inbound transition exists) ORed
  // with the createdAt window.
  const attachmentSql = inboundTransitionId
    ? exists(
        defaultDb
          .select({ id: decisionTransitionProposals.id })
          .from(decisionTransitionProposals)
          .where(
            and(
              eq(decisionTransitionProposals.proposalId, t.id),
              eq(
                decisionTransitionProposals.transitionHistoryId,
                inboundTransitionId,
              ),
            ),
          ),
      )
    : undefined;

  const phaseMembership = attachmentSql
    ? sql`(${attachmentSql} OR ${windowSql})`
    : windowSql;

  return and(statusFilter, phaseMembership)!;
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
  const scope = await resolvePhaseScope({ instance, phaseId, db });

  if (scope.kind === 'unreached') {
    return [];
  }

  const rows = await db
    .select({ id: proposals.id })
    .from(proposals)
    .where(
      and(
        eq(proposals.processInstanceId, instance.id),
        buildPhaseScopeSql({ t: proposals, scope, variant: 'nonDraft' }),
        isNull(proposals.deletedAt),
      ),
    );
  return rows.map((r) => r.id);
}

/**
 * Returns both the non-draft and draft IDs visible in a phase for an
 * authenticated caller, sharing a single phase-scope resolution across
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
  const scope = await resolvePhaseScope({ instance, phaseId, db });

  if (scope.kind === 'unreached') {
    return { nonDraftIds: [], draftIds: [] };
  }

  const accessibleProfilesSubquery = db
    .select({ profileId: profileUsers.profileId })
    .from(profileUsers)
    .where(inArray(profileUsers.authUserId, authUserIds));

  const [nonDraftRows, draftRows] = await Promise.all([
    db
      .select({ id: proposals.id })
      .from(proposals)
      .where(
        and(
          eq(proposals.processInstanceId, instance.id),
          buildPhaseScopeSql({ t: proposals, scope, variant: 'nonDraft' }),
          isNull(proposals.deletedAt),
        ),
      ),
    db
      .select({ id: proposals.id })
      .from(proposals)
      .where(
        and(
          eq(proposals.processInstanceId, instance.id),
          buildPhaseScopeSql({ t: proposals, scope, variant: 'draft' }),
          inArray(proposals.profileId, accessibleProfilesSubquery),
          isNull(proposals.deletedAt),
        ),
      ),
  ]);

  return {
    nonDraftIds: nonDraftRows.map((r) => r.id),
    draftIds: draftRows.map((r) => r.id),
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

  const scope = await resolvePhaseScope({ instance, phaseId, db });

  if (scope.kind === 'unreached') {
    return [];
  }

  return db
    .select()
    .from(proposals)
    .where(
      and(
        eq(proposals.processInstanceId, instanceId),
        buildPhaseScopeSql({ t: proposals, scope, variant: 'nonDraft' }),
        isNull(proposals.deletedAt),
      ),
    )
    .orderBy(desc(proposals.createdAt));
}
