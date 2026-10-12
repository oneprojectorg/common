import { type DbClient, and, db, desc, eq, isNull, sql } from '@op/db/client';
import {
  ProcessStatus,
  decisionTransitionProposals,
  proposalHistory,
  proposals,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';
import type { z } from 'zod';

import {
  CommonError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../utils';
import { assertProfileAccess } from '../assert';
import { getProposalAccessContext } from './getProposalAccessContext';
import {
  getPhaseProposalSqlScope,
  phaseEligiblePredicate,
} from './getProposalsForPhase';
import { isLegacyInstanceData } from './isLegacyInstance';
import { lockProcessInstance } from './lockProcessInstance';
import { resolveManualSelectionStatus } from './resolveManualSelectionStatus';
import { runGenerateReviewAssignments } from './runGenerateReviewAssignments';
import type { proposalAdvanceTargetSchema } from './schemas/advanceProposal';
import {
  type PhaseInstanceData,
  getInstancePhases,
  isLastPhase,
} from './schemas/instanceData';
import { isReviewPhase } from './utils/phaseSettings';

export type ProposalAdvanceTarget = z.infer<typeof proposalAdvanceTargetSchema>;

const NO_PHASE_TO_ADVANCE_INTO = 'This decision has no phase to advance into';

/**
 * The phase an admin can advance this proposal into, or a `null` target when
 * the "Advance to [phase]" action doesn't apply — see
 * {@link resolveAdvancement}.
 */
export async function getProposalAdvanceTarget({
  proposalId,
  user,
}: {
  proposalId: string;
  user: User;
}): Promise<{
  processInstanceId: string;
  target: ProposalAdvanceTarget | null;
}> {
  const processInstanceId = await assertProposalAdmin({ proposalId, user });

  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
    columns: { currentStateId: true, status: true, instanceData: true },
  });

  if (!instance) {
    throw new NotFoundError('Process instance', processInstanceId);
  }

  const advancement = await resolveAdvancement({
    dbClient: db,
    processInstanceId,
    instance,
    proposalId,
  });

  return {
    processInstanceId,
    target: advancement.ok
      ? {
          phaseId: advancement.currentPhase.phaseId,
          phaseName:
            advancement.currentPhase.name ?? advancement.currentPhase.phaseId,
        }
      : null,
  };
}

/**
 * Admin-only: pull one proposal that isn't in the current phase into it, by
 * attaching it to the current phase's inbound transition — the same snapshot
 * row an automatic or manual selection writes. When the current phase is a
 * review phase, review assignments are generated for it after commit.
 *
 * `phaseId` is the phase the admin was offered; if the instance has moved on
 * since, this throws `ConflictError` rather than landing it somewhere else.
 */
export async function advanceProposal({
  proposalId,
  phaseId,
  user,
}: {
  proposalId: string;
  phaseId: string;
  user: User;
}): Promise<{ processInstanceId: string }> {
  const processInstanceId = await assertProposalAdmin({ proposalId, user });

  const reviewAssignmentInput = await db.transaction(async (tx) => {
    // Same lock every phase writer takes, so a concurrent advance, revert or
    // manual selection can't move the phase between the checks and the insert.
    // A vanished instance reads as a moved phase: either way, refresh.
    const lockedInstance = await lockProcessInstance({
      db: tx,
      instanceId: processInstanceId,
    });

    if (lockedInstance?.currentStateId !== phaseId) {
      throw new ConflictError(
        'The decision has moved to another phase; refresh and retry',
      );
    }

    const advancement = await resolveAdvancement({
      dbClient: tx,
      processInstanceId,
      instance: lockedInstance,
      proposalId,
    });

    if (!advancement.ok) {
      throw new ValidationError(advancement.reason);
    }

    const [latestHistory] = await tx
      .select({ historyId: proposalHistory.historyId })
      .from(proposalHistory)
      .where(
        and(
          eq(proposalHistory.id, proposalId),
          eq(proposalHistory.processInstanceId, processInstanceId),
        ),
      )
      .orderBy(desc(proposalHistory.historyCreatedAt))
      .limit(1);

    if (!latestHistory) {
      throw new CommonError(
        `Proposal ${proposalId} has no history record to advance`,
      );
    }

    await tx.insert(decisionTransitionProposals).values({
      processInstanceId,
      transitionHistoryId: advancement.transitionHistoryId,
      proposalId,
      proposalHistoryId: latestHistory.historyId,
    });

    return isReviewPhase(advancement.currentPhase)
      ? {
          instanceId: processInstanceId,
          fromPhaseId: advancement.previousPhaseId,
          toPhaseId: phaseId,
          phases: [...advancement.phases],
          advanceResult: {
            conflict: false as const,
            transitionHistoryId: advancement.transitionHistoryId,
            selectedProposalIds: [proposalId],
          },
        }
      : null;
  });

  // After commit, as in `submitManualSelection`: generation reads the attached
  // row on the pooled connection. Failures are logged, not thrown.
  if (reviewAssignmentInput) {
    await runGenerateReviewAssignments(reviewAssignmentInput);
  }

  return { processInstanceId };
}

/** Asserts decision-admin on the proposal's instance; returns the instance id. */
async function assertProposalAdmin({
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

type Advancement =
  | {
      ok: true;
      currentPhase: PhaseInstanceData;
      previousPhaseId: string;
      phases: readonly PhaseInstanceData[];
      transitionHistoryId: string;
    }
  | { ok: false; reason: string };

/**
 * Whether the proposal can be advanced into the instance's current phase. It
 * can't when the instance isn't published or is legacy; when the current
 * phase is the first (no inbound transition to attach to) or the last
 * (results already processed); when the phase still awaits its manual
 * selection, which an attachment would pre-empt; or when the proposal isn't
 * phase-eligible (deleted, draft, rejected, superseded) or is already in the
 * phase.
 */
async function resolveAdvancement({
  dbClient,
  processInstanceId,
  instance,
  proposalId,
}: {
  dbClient: DbClient;
  processInstanceId: string;
  instance: {
    currentStateId: string | null;
    status: string | null;
    instanceData: unknown;
  };
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
