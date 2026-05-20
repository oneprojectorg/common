import { Events, event } from '@op/events';

import type { AdvancePhaseResult } from './advancePhase';
import { processResults } from './processResults';
import { runGenerateReviewAssignments } from './runGenerateReviewAssignments';
import { type PhaseInstanceData, isLastPhase } from './schemas/instanceData';

export interface OnPhaseAdvancedInput {
  instanceId: string;
  fromPhaseId: string;
  toPhaseId: string;
  phases: PhaseInstanceData[];
  advanceResult: AdvancePhaseResult & { conflict: false };
}

/**
 * Side-effects after a phase transition commits. Runs outside the advance
 * transaction so failures here don't roll back the transition itself.
 */
export async function onPhaseAdvanced(
  input: OnPhaseAdvancedInput,
): Promise<void> {
  const targetPhase = input.phases.find((p) => p.phaseId === input.toPhaseId);

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
    // Best-effort: processResults stamps its own failure row; don't abort the post-advance flow.
    try {
      await processResults({ processInstanceId: input.instanceId });
    } catch (error) {
      console.error(
        `Error processing results for process instance ${input.instanceId}:`,
        error,
      );
    }
  }
}
