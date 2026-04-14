import type { AdvancePhaseResult } from './advancePhase';
import { generateReviewAssignments } from './generateReviewAssignments';
import { runResultsProcessing } from './runResultsProcessing';
import type { PhaseInstanceData } from './schemas/instanceData';

export interface OnPhaseAdvancedInput {
  instanceId: string;
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
export async function onPhaseAdvanced({
  instanceId,
  toPhaseId,
  phases,
  advanceResult,
}: OnPhaseAdvancedInput): Promise<void> {
  const targetPhase = phases.find((p) => p.phaseId === toPhaseId);
  if (targetPhase?.rules?.proposals?.review) {
    try {
      await generateReviewAssignments({
        instanceId,
        phaseId: toPhaseId,
        selectedProposalIds: advanceResult.selectedProposalIds,
      });
    } catch (error) {
      console.error(
        `Review assignment generation failed for instance ${instanceId}, phase ${toPhaseId}:`,
        error,
      );
    }
  }

  const isNowOnFinalPhase = phases[phases.length - 1]?.phaseId === toPhaseId;
  if (isNowOnFinalPhase) {
    await runResultsProcessing(instanceId);
  }
}
