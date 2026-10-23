import { type DbClient, and, eq, isNull, sql } from '@op/db/client';
import { ProcessStatus, proposals } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { getProposalAccessContext } from './getProposalAccessContext';
import { getPhaseProposalSqlScope } from './getProposalsForPhase';
import { isLegacyInstanceData } from './isLegacyInstance';
import type { LockedProcessInstance } from './lockProcessInstance';
import { phaseEligiblePredicate } from './phaseEligibility';
import { assertDecisionAdmin } from './phaseHelpers';
import { resolveManualSelectionStatus } from './resolveManualSelectionStatus';
import {
  type PhaseInstanceData,
  getInstancePhases,
  isLastPhase,
} from './schemas/instanceData';

export type PhaseAdvancement =
  | {
      ok: true;
      currentPhase: PhaseInstanceData;
      previousPhaseId: string;
      phases: readonly PhaseInstanceData[];
      transitionHistoryId: string;
    }
  | { ok: false; reason: string };

type AdvancementInstance = Pick<
  LockedProcessInstance,
  'currentStateId' | 'status' | 'instanceData'
> & { id: string };

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

  await assertDecisionAdmin({
    user,
    decisionProfileId: context.instance.profileId,
  });

  return context.processInstanceId;
}

/**
 * Whether the instance's current phase can take proposals advanced into it
 * one at a time. It can't when the instance isn't published or is legacy;
 * when the current phase is the first (no inbound transition to attach to) or
 * the last (results already processed); or when the phase still awaits its
 * manual selection, which an attachment would pre-empt.
 */
export async function resolvePhaseAdvancement({
  dbClient,
  instance,
}: {
  dbClient: DbClient;
  instance: AdvancementInstance;
}): Promise<PhaseAdvancement> {
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

  const [latestTransition, selectionStatus] = await Promise.all([
    dbClient.query.stateTransitionHistory.findFirst({
      where: { processInstanceId: instance.id },
      orderBy: { transitionedAt: 'desc' },
      columns: { id: true, toStateId: true },
    }),
    resolveManualSelectionStatus({
      instance: { id: instance.id, instanceData, currentStateId },
      dbClient,
    }),
  ]);

  if (latestTransition?.toStateId !== currentStateId) {
    return { ok: false, reason: NO_PHASE_TO_ADVANCE_INTO };
  }

  if (!selectionStatus.selectionsAreConfirmed) {
    return {
      ok: false,
      reason: "Confirm this phase's selected proposals first",
    };
  }

  return {
    ok: true,
    currentPhase,
    previousPhaseId: previousPhase.phaseId,
    phases,
    transitionHistoryId: latestTransition.id,
  };
}

/**
 * {@link resolvePhaseAdvancement} for one proposal, which must also be
 * phase-eligible (not deleted, draft, rejected or superseded) and not already
 * in the phase.
 */
export async function resolveAdvancement({
  dbClient,
  instance,
  proposalId,
}: {
  dbClient: DbClient;
  instance: AdvancementInstance;
  proposalId: string;
}): Promise<PhaseAdvancement> {
  const advancement = await resolvePhaseAdvancement({ dbClient, instance });
  if (!advancement.ok) {
    return advancement;
  }

  const phaseScope = await getPhaseProposalSqlScope({
    instance,
    phaseId: advancement.currentPhase.phaseId,
    authUserIds: [],
    db: dbClient,
  });

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

  return advancement;
}
