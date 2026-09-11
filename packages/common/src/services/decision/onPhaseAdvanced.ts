import { Events, event } from '@op/events';
import { logger } from '@op/logging';

import type { AdvancePhaseResult } from './advancePhase';
import { processResults } from './processResults';
import { runGenerateReviewAssignments } from './runGenerateReviewAssignments';
import { type PhaseInstanceData, isLastPhase } from './schemas/instanceData';
import { isReviewPhase } from './utils/phaseSettings';

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
      logger.error('Failed to send phase transition event', {
        instanceId: input.instanceId,
        error: err,
      });
    });

  if (targetPhase && isReviewPhase(targetPhase)) {
    await runGenerateReviewAssignments(input);
  }

  if (isLastPhase(input.toPhaseId, input.phases)) {
    // Best-effort: processResults stamps its own failure row; don't abort the post-advance flow.
    try {
      const processResultId = await processResults({
        processInstanceId: input.instanceId,
      });

      event
        .send({
          name: Events.resultsProcessed.name,
          data: {
            processInstanceId: input.instanceId,
            processResultId,
          },
        })
        .catch((err) => {
          logger.error('Failed to send results processed event', {
            instanceId: input.instanceId,
            error: err,
          });
        });
    } catch (error) {
      logger.error('Error processing results for process instance', {
        instanceId: input.instanceId,
        error,
      });
    }
  }
}
