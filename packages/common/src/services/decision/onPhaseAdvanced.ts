import { Events, event } from '@op/events';

import type { AdvancePhaseResult } from './advancePhase';
import { runGenerateReviewAssignments } from './runGenerateReviewAssignments';
import { runResultsProcessing } from './runResultsProcessing';
import { type PhaseInstanceData, isLastPhase } from './schemas/instanceData';

export interface OnPhaseAdvancedInput {
  instanceId: string;
  fromPhaseId: string;
  toPhaseId: string;
  phases: PhaseInstanceData[];
  advanceResult: AdvancePhaseResult & { conflict: false };
}

/**
 * Post-advance hook that runs after a successful phase transition commits.
 *
 * Centralises side-effects that should happen whenever a decision instance
 * moves to a new phase — regardless of whether the advance was manual or
 * cron-triggered — so callers of `advancePhase` don't duplicate logic.
 *
 * Runs outside the advance transaction on purpose: a failure here must not
 * roll back the phase transition itself.
 */
export async function onPhaseAdvanced(
  input: OnPhaseAdvancedInput,
): Promise<void> {
  const targetPhase = input.phases.find((p) => p.phaseId === input.toPhaseId);

  // Notify participants about the phase transition (fire-and-forget)
  event
    .send({
      name: Events.phaseTransitioned.name,
      data: {
        processInstanceId: input.instanceId,
        fromPhaseId: input.fromPhaseId,
        toPhaseId: input.toPhaseId,
      },
    })
    .catch((err) => {
      console.error(
        `Failed to send phase transition event for instance ${input.instanceId}:`,
        err,
      );
    });

  if (targetPhase?.rules?.proposals?.review) {
    await runGenerateReviewAssignments(input);
  }

  if (isLastPhase(input.toPhaseId, input.phases)) {
    await runResultsProcessing(input);
  }
}
