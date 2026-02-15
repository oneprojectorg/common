import { db } from '@op/db/client';
import { decisionProcessTransitions } from '@op/db/schema';
import type { ProcessInstance } from '@op/db/schema';

import { CommonError } from '../../utils';
import type { InstanceData, PhaseConfiguration } from './types';

export interface CreateTransitionsInput {
  processInstance: ProcessInstance;
}

export interface CreateTransitionsResult {
  transitions: Array<{
    id: string;
    fromStateId: string | null;
    toStateId: string;
    scheduledDate: Date;
  }>;
}

/**
 * Creates transition records for all phases in a process instance.
 * Each transition represents the end of one phase and the start of the next.
 */
export async function createTransitionsForProcess({
  processInstance,
}: CreateTransitionsInput): Promise<CreateTransitionsResult> {
  try {
    const instanceData = processInstance.instanceData as InstanceData;
    const phases = instanceData.phases;

    if (!phases || phases.length === 0) {
      throw new CommonError(
        'Process instance must have at least one phase configured',
      );
    }

    const transitionsToCreate = phases.flatMap(
      (phase: PhaseConfiguration, index: number) => {
        const scheduledDate = phase.endDate ?? phase.startDate;

        // Skip phases that have no dates yet — they don't need transitions
        if (!scheduledDate) {
          return [];
        }

        const fromStateId = index > 0 ? phases[index - 1]?.phaseId : null;
        const toStateId = phase.phaseId;

        return [
          {
            processInstanceId: processInstance.id,
            fromStateId,
            toStateId,
            scheduledDate: new Date(scheduledDate).toISOString(),
          },
        ];
      },
    );

    const createdTransitions = await db
      .insert(decisionProcessTransitions)
      .values(transitionsToCreate)
      .returning();

    return {
      transitions: createdTransitions.map((t) => ({
        id: t.id,
        fromStateId: t.fromStateId,
        toStateId: t.toStateId,
        scheduledDate: new Date(t.scheduledDate),
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
