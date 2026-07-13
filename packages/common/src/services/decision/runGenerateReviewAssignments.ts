import { logger } from '@op/logging';

import { generateReviewAssignments } from './generateReviewAssignments';
import type { OnPhaseAdvancedInput } from './onPhaseAdvanced';

/** Run review assignment generation. Failures are logged, not thrown. */
export async function runGenerateReviewAssignments(
  input: OnPhaseAdvancedInput,
): Promise<void> {
  try {
    await generateReviewAssignments({
      instanceId: input.instanceId,
      phaseId: input.toPhaseId,
      selectedProposalIds: input.advanceResult.selectedProposalIds,
      transitionHistoryId: input.advanceResult.transitionHistoryId,
    });
  } catch (error) {
    logger.error('Review assignment generation failed', {
      instanceId: input.instanceId,
      toPhaseId: input.toPhaseId,
      error,
    });
  }
}
