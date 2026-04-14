import type { AdvancePhaseResult } from './advancePhase';
import { runGenerateReviewAssignments } from './runGenerateReviewAssignments';
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
export async function onPhaseAdvanced(
  input: OnPhaseAdvancedInput,
): Promise<void> {
  const targetPhase = input.phases.find((p) => p.phaseId === input.toPhaseId);

  if (targetPhase?.rules?.proposals?.review) {
    await runGenerateReviewAssignments(input);
  }

  const isNowOnFinalPhase =
    input.phases[input.phases.length - 1]?.phaseId === input.toPhaseId;
  if (isNowOnFinalPhase) {
    await runResultsProcessing(input);
  }
}
