import { Events, event } from '@op/events';

import type { AdvancePhaseResult } from './advancePhase';
import { processResults } from './processResults';
import { resolveManualSelectionStatus } from './resolveManualSelectionStatus';
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

  // phaseTransitioned is a pure FSM-moved signal; subscribers that care about
  // the actual transition (analytics, audit, future webhooks) get it on every
  // advance.
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

  // selectionsConfirmed marks the new phase as "active for participants" —
  // emitted only when the inbound transition already carries confirmed picks.
  // Otherwise submitManualSelection will fire it once an admin confirms.
  const manualSelectionStatus = await resolveManualSelectionStatus({
    instance: {
      id: input.instanceId,
      instanceData: { phases: input.phases },
      currentStateId: input.toPhaseId,
    },
  });

  if (manualSelectionStatus.selectionsAreConfirmed) {
    event
      .send({
        name: Events.selectionsConfirmed.name,
        data: {
          processInstanceId: input.instanceId,
          fromPhaseId: input.fromPhaseId,
          toPhaseId: input.toPhaseId,
        },
      })
      .catch((err) => {
        console.error(
          `Failed to send selections confirmed event for instance ${input.instanceId}:`,
          err,
        );
      });
  }

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
