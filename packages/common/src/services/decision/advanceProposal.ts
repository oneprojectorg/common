import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';

import { ConflictError, ValidationError } from '../../utils';
import { attachProposalsToTransition } from './attachProposalsToTransition';
import { lockProcessInstance } from './lockProcessInstance';
import { assertProposalAdmin, resolveAdvancement } from './proposalAdvancement';
import { runGenerateReviewAssignments } from './runGenerateReviewAssignments';
import { isReviewPhase } from './utils/phaseSettings';

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
      instance: { id: processInstanceId, ...lockedInstance },
      proposalId,
    });

    if (!advancement.ok) {
      throw new ValidationError(advancement.reason);
    }

    await attachProposalsToTransition({
      dbClient: tx,
      processInstanceId,
      transitionHistoryId: advancement.transitionHistoryId,
      proposalIds: [proposalId],
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
