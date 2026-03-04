import type { ProcessInstance } from '@op/db/schema';

import { CommonError } from '../../utils';
import type { DecisionInstanceData } from './schemas/instanceData';
import type { ScheduledTransition } from './types';

/**
 * Builds expected transition records from a process instance's phase data.
 * Only creates transitions for phases with date-based advancement
 * (rules.advancement.method === 'date').
 *
 * Shared by both `createTransitionsForProcess` and `updateTransitionsForProcess`.
 */
export function buildExpectedTransitions(
  processInstance: ProcessInstance,
): ScheduledTransition[] {
  // Type assertion: instanceData is `unknown` in DB to support legacy formats for viewing,
  // but this function is only called for new DecisionInstanceData processes
  const instanceData = processInstance.instanceData as DecisionInstanceData;
  const phases = instanceData.phases;

  if (!phases || phases.length === 0) {
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
        `Phase "${currentPhase.phaseId}" must have an end date for date-based advancement (instance: ${processInstance.id})`,
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
