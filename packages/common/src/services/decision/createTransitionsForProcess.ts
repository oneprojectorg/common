import { db } from '@op/db/client';
import { decisionProcessTransitions } from '@op/db/schema';
import type { ProcessInstance } from '@op/db/schema';

import type { DecisionInstanceData } from '../../lib/decisionSchemas/instanceData';
import { CommonError } from '../../utils';

/**
 * Creates scheduled transition records for phases with date-based advancement.
 * Each transition fires when the next phase's start date arrives.
 */
export async function createTransitionsForProcess({ processInstance }: { processInstance: ProcessInstance }): Promise<{
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

    for (let index = 0; index < phases.length - 1; index++) {
      const currentPhase = phases[index]!;
      const nextPhase = phases[index + 1]!;

      // Only create transition if current phase uses date-based advancement
      if (currentPhase.rules?.advancement?.method !== 'date') {
        continue;
      }

      // Schedule transition when the next phase starts
      const scheduledDate = nextPhase.plannedStartDate;

      if (!scheduledDate) {
        throw new CommonError(
          `Phase "${nextPhase.phaseId}" must have a start date for date-based advancement from "${currentPhase.phaseId}" (instance: ${processInstance.id})`,
        );
      }

      // DB columns are named fromStateId/toStateId but store phase IDs
      transitionsToCreate.push({
        processInstanceId: processInstance.id,
        fromStateId: currentPhase.phaseId,
        toStateId: nextPhase.phaseId,
        scheduledDate: new Date(scheduledDate).toISOString(),
      });
    }

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
