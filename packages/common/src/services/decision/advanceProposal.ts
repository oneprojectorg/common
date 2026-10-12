import {
  type DbClient,
  and,
  db,
  desc,
  eq,
  isNull,
  notInArray,
} from '@op/db/client';
import {
  ProcessStatus,
  decisionTransitionProposals,
  proposalHistory,
  proposals,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import {
  CommonError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../utils';
import { assertProfileAccess } from '../assert';
import { getProposalIdsForPhase } from './getProposalsForPhase';
import { isLegacyInstanceData } from './isLegacyInstance';
import { lockProcessInstance } from './lockProcessInstance';
import { notSuperseded } from './proposalSupersession';
import { runGenerateReviewAssignments } from './runGenerateReviewAssignments';
import {
  type DecisionInstanceData,
  type PhaseInstanceData,
  isLastPhase,
} from './schemas/instanceData';
import type { TransitionData } from './schemas/transitionData';
import { isReviewPhase } from './utils/phaseSettings';
import { PIPELINE_INELIGIBLE_STATUSES } from './votingEligibility';

export type ProposalAdvanceTarget = {
  phaseId: string;
  phaseName: string;
};

export type AdvanceProposalResult = {
  processInstanceId: string;
  proposalId: string;
};

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
  const proposal = await getAdminScopedProposal({ proposalId, user });

  const instance = await db.query.processInstances.findFirst({
    where: { id: proposal.processInstanceId },
    columns: { currentStateId: true, status: true, instanceData: true },
  });

  if (!instance) {
    throw new NotFoundError('Process instance', proposal.processInstanceId);
  }

  const advancement = await resolveAdvancement({
    dbClient: db,
    processInstanceId: proposal.processInstanceId,
    instance,
    proposalId,
  });

  return {
    processInstanceId: proposal.processInstanceId,
    target: advancement.ok ? advancement.target : null,
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
}): Promise<AdvanceProposalResult> {
  const { processInstanceId } = await getAdminScopedProposal({
    proposalId,
    user,
  });

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
          phases: advancement.phases,
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

  return { processInstanceId, proposalId };
}

/**
 * Loads the proposal and asserts decision-admin on its instance. Deleted and
 * moderation-detached proposals read as missing, as they do everywhere else.
 */
async function getAdminScopedProposal({
  proposalId,
  user,
}: {
  proposalId: string;
  user: User;
}): Promise<{ processInstanceId: string }> {
  const proposal = await db.query.proposals.findFirst({
    where: {
      RAW: (table) =>
        and(
          eq(table.id, proposalId),
          isNull(table.deletedAt),
          isNull(table.moderationDetachedAt),
        )!,
    },
    columns: { processInstanceId: true },
    with: { processInstance: { columns: { profileId: true } } },
  });

  if (!proposal?.processInstance?.profileId) {
    throw new NotFoundError('Proposal', proposalId);
  }

  await assertProfileAccess({
    user,
    profileId: proposal.processInstance.profileId,
    permissions: { decisions: permission.ADMIN },
  });

  return { processInstanceId: proposal.processInstanceId };
}

type Advancement =
  | {
      ok: true;
      target: ProposalAdvanceTarget;
      transitionHistoryId: string;
      previousPhaseId: string;
      currentPhase: PhaseInstanceData;
      phases: PhaseInstanceData[];
    }
  | { ok: false; reason: string };

type TargetPhase =
  | {
      ok: true;
      currentStateId: string;
      currentPhase: PhaseInstanceData;
      previousPhaseId: string;
      phases: PhaseInstanceData[];
    }
  | { ok: false; reason: string };

/**
 * The instance's current phase, when a proposal can be advanced into it: the
 * instance is published and not legacy, and the phase is neither its first
 * (no inbound transition to attach to) nor its last (results already
 * processed).
 */
function getTargetPhase(instance: {
  currentStateId: string | null;
  status: string | null;
  instanceData: unknown;
}): TargetPhase {
  const { currentStateId } = instance;

  if (
    instance.status !== ProcessStatus.PUBLISHED ||
    !currentStateId ||
    isLegacyInstanceData(instance.instanceData)
  ) {
    return { ok: false, reason: 'This decision has no phase to advance into' };
  }

  const phases =
    (instance.instanceData as DecisionInstanceData | null)?.phases ?? [];
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

  return {
    ok: true,
    currentStateId,
    currentPhase,
    previousPhaseId: previousPhase.phaseId,
    phases,
  };
}

/**
 * Whether the proposal can be advanced into the instance's current phase: see
 * {@link getTargetPhase} and {@link getAdvancementBlocker}.
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
  const targetPhase = getTargetPhase(instance);
  if (!targetPhase.ok) {
    return targetPhase;
  }
  const { currentStateId, currentPhase } = targetPhase;

  const latestTransition =
    await dbClient.query.stateTransitionHistory.findFirst({
      where: { processInstanceId },
      orderBy: { transitionedAt: 'desc' },
      columns: { id: true, toStateId: true, transitionData: true },
    });

  if (latestTransition?.toStateId !== currentStateId) {
    return {
      ok: false,
      reason: 'This decision has no phase to advance into',
    };
  }

  const blocker = await getAdvancementBlocker({
    dbClient,
    processInstanceId,
    instanceData: instance.instanceData,
    currentStateId,
    latestTransition,
    proposalId,
  });

  if (blocker) {
    return { ok: false, reason: blocker };
  }

  return {
    ok: true,
    target: {
      phaseId: currentStateId,
      phaseName: currentPhase.name ?? currentStateId,
    },
    transitionHistoryId: latestTransition.id,
    previousPhaseId: targetPhase.previousPhaseId,
    currentPhase,
    phases: targetPhase.phases,
  };
}

/**
 * Why this proposal can't join the current phase, or `null` if it can: the
 * phase still awaits its manual selection (an attachment would pre-empt it),
 * or the proposal is a draft, rejected, superseded, or already in the phase.
 */
async function getAdvancementBlocker({
  dbClient,
  processInstanceId,
  instanceData,
  currentStateId,
  latestTransition,
  proposalId,
}: {
  dbClient: DbClient;
  processInstanceId: string;
  instanceData: unknown;
  currentStateId: string;
  latestTransition: { id: string; transitionData: unknown };
  proposalId: string;
}): Promise<string | null> {
  const [eligible, attached, idsInPhase] = await Promise.all([
    dbClient
      .select({ id: proposals.id })
      .from(proposals)
      .where(
        and(
          eq(proposals.id, proposalId),
          notInArray(proposals.status, PIPELINE_INELIGIBLE_STATUSES),
          notSuperseded({
            proposalId: proposals.id,
            processInstanceId: proposals.processInstanceId,
          }),
        ),
      )
      .limit(1),
    dbClient.query.decisionTransitionProposals.findFirst({
      where: { transitionHistoryId: latestTransition.id },
      columns: { id: true },
    }),
    getProposalIdsForPhase({
      instance: {
        id: processInstanceId,
        instanceData,
        currentStateId,
      },
      phaseId: currentStateId,
      db: dbClient,
    }),
  ]);

  const selectionIsPending =
    !attached &&
    !(latestTransition.transitionData as TransitionData | null)
      ?.manualSelection;

  if (selectionIsPending) {
    return "Confirm this phase's selected proposals first";
  }
  if (eligible.length === 0) {
    return 'Only submitted proposals can be advanced';
  }
  if (idsInPhase.includes(proposalId)) {
    return 'This proposal is already in the current phase';
  }
  return null;
}
