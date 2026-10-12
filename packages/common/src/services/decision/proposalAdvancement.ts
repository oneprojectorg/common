import { type DbClient, and, eq, isNull, sql } from '@op/db/client';
import { ProcessStatus, proposals } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { assertProfileAccess } from '../assert';
import { getProposalAccessContext } from './getProposalAccessContext';
import { getPhaseProposalSqlScope } from './getProposalsForPhase';
import { isLegacyInstanceData } from './isLegacyInstance';
import type { LockedProcessInstance } from './lockProcessInstance';
import { phaseEligiblePredicate } from './phaseEligibility';
import { resolveManualSelectionStatus } from './resolveManualSelectionStatus';
import {
  type PhaseInstanceData,
  getInstancePhases,
  isLastPhase,
} from './schemas/instanceData';

/**
 * Shared by `getProposalAdvanceTarget` and `advanceProposal`: who may advance
 * a proposal into the current phase, and whether it can go.
 */

export type Advancement =
  | {
      ok: true;
      currentPhase: PhaseInstanceData;
      previousPhaseId: string;
      phases: readonly PhaseInstanceData[];
      transitionHistoryId: string;
    }
  | { ok: false; reason: string };

const NO_PHASE_TO_ADVANCE_INTO = 'This decision has no phase to advance into';

/** Asserts decision-admin on the proposal's instance; returns the instance id. */
export async function assertProposalAdmin({
  proposalId,
  user,
}: {
  proposalId: string;
  user: User;
}): Promise<string> {
  const context = await getProposalAccessContext(proposalId);

  await assertProfileAccess({
    user,
    profileId: context.instance.profileId,
    permissions: { decisions: permission.ADMIN },
  });

  return context.processInstanceId;
}

/**
 * Whether the proposal can be advanced into the instance's current phase. It
 * can't when the instance isn't published or is legacy; when the current
 * phase is the first (no inbound transition to attach to) or the last
 * (results already processed); when the phase still awaits its manual
 * selection, which an attachment would pre-empt; or when the proposal isn't
 * phase-eligible (deleted, draft, rejected, superseded) or is already in the
 * phase.
 */
export async function resolveAdvancement({
  dbClient,
  processInstanceId,
  instance,
  proposalId,
}: {
  dbClient: DbClient;
  processInstanceId: string;
  instance: LockedProcessInstance;
  proposalId: string;
}): Promise<Advancement> {
  const { currentStateId, instanceData } = instance;

  if (
    instance.status !== ProcessStatus.PUBLISHED ||
    !currentStateId ||
    isLegacyInstanceData(instanceData)
  ) {
    return { ok: false, reason: NO_PHASE_TO_ADVANCE_INTO };
  }

  const phases = getInstancePhases(instanceData);
  const currentIndex = phases.findIndex((p) => p.phaseId === currentStateId);
  const currentPhase = phases[currentIndex];
  const previousPhase = phases[currentIndex - 1];

  if (!currentPhase || !previousPhase) {
    return {
      ok: false,
      reason: 'Proposals cannot be advanced into the first phase',
    };
  }

  if (isLastPhase(currentStateId, phases)) {
    return {
      ok: false,
      reason: 'Proposals cannot be advanced into the final phase',
    };
  }

  const transition = await getAdvancementTransition({
    dbClient,
    instance: { id: processInstanceId, instanceData, currentStateId },
    proposalId,
  });

  if (!transition.ok) {
    return transition;
  }

  return {
    ok: true,
    currentPhase,
    previousPhaseId: previousPhase.phaseId,
    phases,
    transitionHistoryId: transition.transitionHistoryId,
  };
}

/**
 * The checks that need the database: the current phase's inbound transition
 * exists and its selection is confirmed, and the proposal is phase-eligible
 * but not yet in the phase.
 */
async function getAdvancementTransition({
  dbClient,
  instance,
  proposalId,
}: {
  dbClient: DbClient;
  instance: { id: string; instanceData: unknown; currentStateId: string };
  proposalId: string;
}): Promise<
  { ok: true; transitionHistoryId: string } | { ok: false; reason: string }
> {
  const [latestTransition, selectionStatus, phaseScope] = await Promise.all([
    dbClient.query.stateTransitionHistory.findFirst({
      where: { processInstanceId: instance.id },
      orderBy: { transitionedAt: 'desc' },
      columns: { id: true, toStateId: true },
    }),
    resolveManualSelectionStatus({ instance, dbClient }),
    getPhaseProposalSqlScope({
      instance,
      phaseId: instance.currentStateId,
      authUserIds: [],
      db: dbClient,
    }),
  ]);

  if (latestTransition?.toStateId !== instance.currentStateId) {
    return { ok: false, reason: NO_PHASE_TO_ADVANCE_INTO };
  }

  if (!selectionStatus.selectionsAreConfirmed) {
    return {
      ok: false,
      reason: "Confirm this phase's selected proposals first",
    };
  }

  // A plain select rather than RBQ: phase membership is an SQL predicate from
  // the phase scope, projected here as a column.
  const [proposal] = await dbClient
    .select({
      isInPhase: sql<boolean>`${phaseScope.buildNonDraftFilter(proposals)}`,
    })
    .from(proposals)
    .where(
      and(
        eq(proposals.id, proposalId),
        isNull(proposals.deletedAt),
        phaseEligiblePredicate(proposals),
      ),
    )
    .limit(1);

  if (!proposal) {
    return { ok: false, reason: 'Only submitted proposals can be advanced' };
  }

  if (proposal.isInPhase) {
    return {
      ok: false,
      reason: 'This proposal is already in the current phase',
    };
  }

  return { ok: true, transitionHistoryId: latestTransition.id };
}
