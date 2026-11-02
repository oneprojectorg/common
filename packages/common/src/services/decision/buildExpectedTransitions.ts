import { CommonError } from '../../utils';
import type { PhaseInstanceData } from './schemas/instanceData';
import type { ScheduledTransition } from './types';

/**
 * Builds expected transition records from a process instance's phases.
 * Only creates transitions for phases with date-based advancement
 * (rules.advancement.method === 'date').
 *
 * Shared by both `createTransitionsForProcess` and `updateTransitionsForProcess`.
 */
export function buildExpectedTransitions({
  processInstanceId,
  phases,
}: {
  processInstanceId: string;
  phases: readonly PhaseInstanceData[];
}): ScheduledTransition[] {
  if (phases.length === 0) {
    throw new CommonError(
      'Process instance must have at least one phase configured',
    );
  }

  const transitions: ScheduledTransition[] = [];

  phases.forEach((currentPhase, index) => {
    const nextPhase = phases[index + 1];
    // Skip last phase (no next phase to transition to)
    if (!nextPhase) {
      return;
    }

    // Only create transition if current phase uses date-based advancement
    if (currentPhase.rules?.advancement?.method !== 'date') {
      return;
    }

    // Schedule transition when the current phase ends
    const scheduledDate = currentPhase.endDate;

    if (!scheduledDate) {
      throw new CommonError(
        `Phase "${currentPhase.phaseId}" must have an end date for date-based advancement (instance: ${processInstanceId})`,
      );
    }

    // DB columns are named fromStateId/toStateId but store phase IDs
    transitions.push({
      processInstanceId,
      fromStateId: currentPhase.phaseId,
      toStateId: nextPhase.phaseId,
      scheduledDate: new Date(scheduledDate).toISOString(),
    });
  });

  return transitions;
}
