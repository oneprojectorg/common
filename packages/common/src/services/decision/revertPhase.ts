import {
  type DbClient,
  and,
  db,
  desc,
  eq,
  gt,
  gte,
  isNotNull,
  isNull,
  ne,
} from '@op/db/client';
import {
  ProcessStatus,
  ProposalReviewAssignmentStatus,
  decisionProcessResults,
  decisionProcessTransitions,
  processInstances,
  proposalReviewAssignments,
  stateTransitionHistory,
} from '@op/db/schema';
import { logger } from '@op/logging';

import {
  CommonError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../utils';
import { lockProcessInstance } from './lockProcessInstance';
import type {
  DecisionInstanceData,
  PhaseInstanceData,
} from './schemas/instanceData';

export interface RevertPhaseInput {
  instanceId: string;
  /**
   * The phase the caller observed as current. When provided, the reversal only
   * proceeds if the instance is still on this phase, so a stale admin screen
   * can't undo a transition the operator never saw.
   */
  fromPhaseId?: string;
}

export interface RevertPhaseResult {
  /** The phase the instance is on after the reversal. */
  currentPhaseId: string;
  /** The phase the instance was moved back out of. */
  revertedPhaseId: string;
}

/** The transition to undo, resolved under the instance lock. */
interface RevertTarget {
  transitionHistoryId: string;
  transitionedAt: Date;
  /** The phase we return to — the transition's origin. */
  targetPhaseId: string;
  /** The phase we leave — the instance's current phase. */
  revertedPhaseId: string;
}

/**
 * Undo the most recent phase advancement of a decision instance — a
 * platform-admin escape hatch for a premature or mistaken advance. There is
 * deliberately no user-facing equivalent; authorization lives in the calling
 * procedure's platform-admin middleware.
 *
 * Undoes everything the advance wrote, in one transaction:
 *
 * 1. Deletes the review assignments generated on entry to the phase being
 *    reverted. Fails closed if a reviewer already touched one (any status past
 *    `PENDING`) rather than cascade-deleting their reviews.
 * 2. Stamps `revertedAt` on the results the advance recorded. The rows stay as
 *    an audit trail that a result once occurred; the stamp is what stops every
 *    "are results published?" read from treating them as live.
 * 3. Deletes the `stateTransitionHistory` row, which cascades to
 *    `decisionTransitionProposals` — the proposals that were attached as
 *    belonging to the phase we're leaving stop being members of it.
 * 4. Re-opens the scheduled transition the advance stamped complete, but only
 *    while it is still future-dated (see `undoAdvanceWrites`).
 * 5. Moves `currentStateId` back, under the same optimistic lock
 *    `advancePhase` uses.
 *
 * Votes are deliberately untouched: `decisionsVoteSubmissions` is scoped to
 * the instance rather than a phase, and its unique `(instance, voter)`
 * constraint means a re-advance reuses the same ballots rather than
 * double-counting them. Leaving a result row unstamped would republish those
 * tallies mid-vote, which is why step 2 is not optional.
 *
 * Deleting the history row is the undo, rather than appending a compensating
 * `B → A` row: phase membership is derived from transitions, and the most
 * recent transition INTO a phase defines its inbound window
 * (`getProposalsForPhase`). A compensating row would make the returned-to
 * phase's window start now with an empty attachment set, hiding every proposal
 * submitted before the reversal.
 *
 * Not reversible: the `phaseTransitioned` event the advance emitted has
 * already gone out as member notifications.
 */
export async function revertPhase({
  instanceId,
  fromPhaseId: expectedFromPhaseId,
}: RevertPhaseInput): Promise<RevertPhaseResult> {
  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
    columns: { id: true, status: true, currentStateId: true },
  });

  if (!instance) {
    throw new NotFoundError('Process instance', instanceId);
  }

  if (instance.status !== ProcessStatus.PUBLISHED) {
    throw new ValidationError('Instance must be published');
  }

  if (!instance.currentStateId) {
    throw new ValidationError('Instance has no current phase set');
  }

  if (expectedFromPhaseId && expectedFromPhaseId !== instance.currentStateId) {
    throw new ConflictError(
      `Instance is on phase '${instance.currentStateId}', not '${expectedFromPhaseId}'`,
    );
  }

  const observedPhaseId = instance.currentStateId;
  const now = new Date().toISOString();

  const target = await db.transaction(async (tx) => {
    const locked = await lockCurrentPhase({ tx, instanceId, observedPhaseId });
    const revertTarget = await resolveTransitionToUndo({
      tx,
      instanceId,
      locked,
    });

    await deletePendingReviewAssignments({
      tx,
      instanceId,
      phaseId: revertTarget.revertedPhaseId,
    });

    await undoAdvanceWrites({ tx, instanceId, target: revertTarget, now });

    return revertTarget;
  });

  // Deleting the history row removes the only record that the advance
  // happened, so leave a trail of the reversal itself.
  logger.info('Decision phase reverted', {
    instanceId,
    revertedPhaseId: target.revertedPhaseId,
    currentPhaseId: target.targetPhaseId,
    deletedTransitionHistoryId: target.transitionHistoryId,
  });

  return {
    currentPhaseId: target.targetPhaseId,
    revertedPhaseId: target.revertedPhaseId,
  };
}

/**
 * Locks the instance and re-checks, inside the lock, what the caller validated
 * on an unlocked snapshot. Returns the phase being reverted out of.
 */
async function lockCurrentPhase({
  tx,
  instanceId,
  observedPhaseId,
}: {
  tx: DbClient;
  instanceId: string;
  observedPhaseId: string;
}): Promise<{ revertedPhaseId: string; phases: PhaseInstanceData[] }> {
  // Same lock order as advancePhase and submitManualSelection — instance
  // first, then the transition row — so the three can't deadlock.
  const lockedInstance = await lockProcessInstance({ db: tx, instanceId });

  if (!lockedInstance) {
    throw new NotFoundError('Process instance', instanceId);
  }

  if (lockedInstance.status !== ProcessStatus.PUBLISHED) {
    throw new ConflictError(
      'Instance is no longer published; refresh and retry',
    );
  }

  const revertedPhaseId = lockedInstance.currentStateId;

  if (!revertedPhaseId || revertedPhaseId !== observedPhaseId) {
    throw new ConflictError(
      'Instance has changed phase since the reversal started; refresh and retry',
    );
  }

  return {
    revertedPhaseId,
    phases:
      (lockedInstance.instanceData as DecisionInstanceData | null)?.phases ??
      [],
  };
}

/**
 * Locks and validates the transition to undo. Only the most recent transition
 * is reversible — anything else means the instance moved on and the caller is
 * working from a stale view.
 */
async function resolveTransitionToUndo({
  tx,
  instanceId,
  locked,
}: {
  tx: DbClient;
  instanceId: string;
  locked: { revertedPhaseId: string; phases: PhaseInstanceData[] };
}): Promise<RevertTarget> {
  const { revertedPhaseId, phases } = locked;

  const [latestTransition] = await tx
    .select({
      id: stateTransitionHistory.id,
      fromStateId: stateTransitionHistory.fromStateId,
      toStateId: stateTransitionHistory.toStateId,
      transitionedAt: stateTransitionHistory.transitionedAt,
    })
    .from(stateTransitionHistory)
    .where(eq(stateTransitionHistory.processInstanceId, instanceId))
    .orderBy(desc(stateTransitionHistory.transitionedAt))
    .limit(1)
    .for('update');

  if (!latestTransition) {
    throw new ValidationError(
      'Instance has never advanced, so there is nothing to revert',
    );
  }

  if (latestTransition.toStateId !== revertedPhaseId) {
    throw new ConflictError(
      'The latest transition no longer matches the current phase; refresh and retry',
    );
  }

  // The history row is authoritative for where the instance came from —
  // more reliable than walking back one entry in the configured phase list.
  const targetPhaseId = latestTransition.fromStateId;

  if (!targetPhaseId) {
    throw new ValidationError(
      'The latest transition has no origin phase to return to',
    );
  }

  if (!phases.some((phase) => phase.phaseId === targetPhaseId)) {
    throw new CommonError(
      `Phase ${targetPhaseId} is no longer defined on instance ${instanceId}`,
    );
  }

  return {
    transitionHistoryId: latestTransition.id,
    transitionedAt: latestTransition.transitionedAt,
    targetPhaseId,
    revertedPhaseId,
  };
}

/** Deletes the rows the advance produced and moves `currentStateId` back. */
async function undoAdvanceWrites({
  tx,
  instanceId,
  target,
  now,
}: {
  tx: DbClient;
  instanceId: string;
  target: RevertTarget;
  now: string;
}): Promise<void> {
  // Keep the results the advance recorded — they are the audit trail that a
  // result once occurred — but stamp them so no reader treats them as the
  // instance's live published result while it sits back in an earlier phase.
  // Without this, `listProposals` would republish real vote tallies into a
  // re-opened voting phase.
  await tx
    .update(decisionProcessResults)
    .set({ revertedAt: now })
    .where(
      and(
        eq(decisionProcessResults.processInstanceId, instanceId),
        gte(
          decisionProcessResults.executedAt,
          target.transitionedAt.toISOString(),
        ),
        isNull(decisionProcessResults.revertedAt),
      ),
    );

  // Cascades to decisionTransitionProposals via dtp_transition_history_fkey.
  await tx
    .delete(stateTransitionHistory)
    .where(eq(stateTransitionHistory.id, target.transitionHistoryId));

  // Only re-open a schedule that hasn't come due: the advance stamps every
  // pending row for the departing phase, including ones a manual advance
  // fired early. Re-opening an already-due row would hand it straight back to
  // the date cron, which would re-advance within minutes.
  await tx
    .update(decisionProcessTransitions)
    .set({ completedAt: null })
    .where(
      and(
        eq(decisionProcessTransitions.processInstanceId, instanceId),
        eq(decisionProcessTransitions.fromStateId, target.targetPhaseId),
        eq(decisionProcessTransitions.toStateId, target.revertedPhaseId),
        isNotNull(decisionProcessTransitions.completedAt),
        gt(decisionProcessTransitions.scheduledDate, now),
      ),
    );

  const updated = await tx
    .update(processInstances)
    .set({ currentStateId: target.targetPhaseId, updatedAt: now })
    .where(
      and(
        eq(processInstances.id, instanceId),
        eq(processInstances.currentStateId, target.revertedPhaseId),
        eq(processInstances.status, ProcessStatus.PUBLISHED),
      ),
    )
    .returning({ id: processInstances.id });

  if (updated.length === 0) {
    throw new ConflictError('Phase reversal conflict');
  }
}

/**
 * Removes the phase's review assignments, which the advance generated on entry.
 * Refuses when a reviewer has already engaged with one: every status past
 * `PENDING` is set by a reviewer action, and deleting the assignment would
 * cascade away their draft or submitted review.
 */
async function deletePendingReviewAssignments({
  tx,
  instanceId,
  phaseId,
}: {
  tx: DbClient;
  instanceId: string;
  phaseId: string;
}): Promise<void> {
  const startedAssignments = await tx
    .select({ id: proposalReviewAssignments.id })
    .from(proposalReviewAssignments)
    .where(
      and(
        eq(proposalReviewAssignments.processInstanceId, instanceId),
        eq(proposalReviewAssignments.phaseId, phaseId),
        ne(
          proposalReviewAssignments.status,
          ProposalReviewAssignmentStatus.PENDING,
        ),
      ),
    );

  if (startedAssignments.length > 0) {
    throw new ValidationError(
      `Cannot revert this phase: ${startedAssignments.length} review assignment(s) have already been started. Reverting would delete that review work.`,
    );
  }

  // The PENDING predicate is repeated on the DELETE so a row started between
  // the check above and this statement survives instead of losing its review.
  await tx
    .delete(proposalReviewAssignments)
    .where(
      and(
        eq(proposalReviewAssignments.processInstanceId, instanceId),
        eq(proposalReviewAssignments.phaseId, phaseId),
        eq(
          proposalReviewAssignments.status,
          ProposalReviewAssignmentStatus.PENDING,
        ),
      ),
    );
}
