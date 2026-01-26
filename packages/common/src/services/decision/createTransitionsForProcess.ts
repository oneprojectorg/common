import { db } from '@op/db/client';
import { decisionProcessTransitions } from '@op/db/schema';
import type { ProcessInstance } from '@op/db/schema';

import { CommonError } from '../../utils';
import type { DecisionInstanceData } from './schemas/instanceData';

/**
 * Creates scheduled transition records for phases with date-based advancement.
 * Each transition fires when the current phase's end date arrives.
 */
export async function createTransitionsForProcess({
  processInstance,
}: {
  processInstance: ProcessInstance;
}): Promise<{
  transitions: Array<{
    id: string;
    fromStateId: string | null;
    toStateId: string;
    scheduledDate: Date;
  }>;
}> {
  try {
    // Type assertion: instanceData is `unknown` in DB to support legacy formats for viewing,
    // but this function is only called for new DecisionInstanceData processes
    const instanceData = processInstance.instanceData as DecisionInstanceData;
    const phases = instanceData.phases;

    if (!phases || phases.length === 0) {
      throw new CommonError(
        'Process instance must have at least one phase configured',
      );
    }

    // Create transitions for phases that use date-based advancement
    // A transition is created FROM a phase (when it ends) TO the next phase
    const transitionsToCreate: Array<{
      processInstanceId: string;
      fromStateId: string;
      toStateId: string;
      scheduledDate: string;
    }> = [];

    phases.forEach((currentPhase, index) => {
      const nextPhase = phases[index + 1];
      if (!nextPhase) return; // Skip last phase (no next phase to transition to)

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
      transitionsToCreate.push({
        processInstanceId: processInstance.id,
        fromStateId: currentPhase.phaseId,
        toStateId: nextPhase.phaseId,
        scheduledDate: new Date(scheduledDate).toISOString(),
      });
    });

    if (transitionsToCreate.length === 0) {
      return { transitions: [] };
    }

    const createdTransitions = await db
      .insert(decisionProcessTransitions)
      .values(transitionsToCreate)
      .returning();

    return {
      transitions: createdTransitions.map((transition) => ({
        id: transition.id,
        fromStateId: transition.fromStateId,
        toStateId: transition.toStateId,
        scheduledDate: new Date(transition.scheduledDate),
      })),
    };
  } catch (error) {
    if (error instanceof CommonError) {
      throw error;
    }
    console.error('Error creating transitions for process:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new CommonError(
      `Failed to create process transitions: ${errorMessage}`,
    );
  }
}
