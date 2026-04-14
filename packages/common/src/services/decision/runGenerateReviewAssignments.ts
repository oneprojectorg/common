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
    });
  } catch (error) {
    console.error(
      `Review assignment generation failed for instance ${input.instanceId}, phase ${input.toPhaseId}:`,
      error,
    );
  }
}
