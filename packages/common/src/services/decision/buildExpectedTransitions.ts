import { CommonError, ValidationError } from '../../utils';
import type { PhaseInstanceData } from './schemas/instanceData';
import type { ScheduledTransition } from './types';
import { hasPhaseEnded } from './utils/phaseOrder';

/**
 * Builds expected transition records from a process instance's phase data.
 * Only creates transitions for phases with date-based advancement
 * (rules.advancement.method === 'date').
 *
 * Shared by both `createTransitionsForProcess` and `updateTransitionsForProcess`.
 */
export function buildExpectedTransitions(processInstance: {
  id: string;
  phases: readonly PhaseInstanceData[];
  currentStateId: string | null;
}): ScheduledTransition[] {
  const { phases, currentStateId } = processInstance;

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

    // A phase the decision has already left can never be advanced from.
    if (hasPhaseEnded(processInstance, currentPhase.phaseId, currentStateId)) {
      return;
    }

    // Only create transition if current phase uses date-based advancement
    if (currentPhase.rules?.advancement?.method !== 'date') {
      return;
    }

    // Schedule transition when the current phase ends
    const scheduledDate = currentPhase.endDate;

    if (!scheduledDate) {
      const phaseName = currentPhase.name?.trim() || currentPhase.phaseId;
      throw new ValidationError(
        `Phase "${phaseName}" must have an end date because it advances by date`,
        { phases: `Set an end date for "${phaseName}"` },
      );
    }

    // DB columns are named fromStateId/toStateId but store phase IDs
    transitions.push({
      processInstanceId: processInstance.id,
      fromStateId: currentPhase.phaseId,
      toStateId: nextPhase.phaseId,
      scheduledDate: new Date(scheduledDate).toISOString(),
    });
  });

  return transitions;
}
