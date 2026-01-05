import { db, eq } from '@op/db/client';
import { decisionProcessTransitions } from '@op/db/schema';
import type { ProcessInstance } from '@op/db/schema';
import pMap from 'p-map';

import type { DecisionInstanceData } from '../../lib/decisionSchemas/instanceData';
import { CommonError } from '../../utils';

/**
 * Updates transition records for a process instance when phase dates change.
 * Only handles phases with date-based advancement (rules.advancement.method === 'date').
 * This function:
 * - Updates existing transitions with new scheduled dates
 * - Creates new transitions for newly added date-based phases
 * - Deletes transitions for phases that no longer use date-based advancement
 * - Prevents updates to completed transitions (results phase is locked)
 */
export async function updateTransitionsForProcess({ processInstance }: { processInstance: ProcessInstance }): Promise<{
  updated: number;
  created: number;
  deleted: number;
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

    // Get existing transitions
    const existingTransitions =
      await db.query.decisionProcessTransitions.findMany({
        where: eq(
          decisionProcessTransitions.processInstanceId,
          processInstance.id,
        ),
        orderBy: (transitions, { asc }) => [asc(transitions.scheduledDate)],
      });

    const result = {
      updated: 0,
      created: 0,
      deleted: 0,
    };

    // Build expected transitions for phases with date-based advancement
    // A transition is created FROM a phase (when it ends) TO the next phase
    const expectedTransitions: Array<{
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
      expectedTransitions.push({
        fromStateId: currentPhase.phaseId,
        toStateId: nextPhase.phaseId,
        scheduledDate: new Date(scheduledDate).toISOString(),
      });
    }

    // Process each expected transition in parallel
    const updateResults = await pMap(
      expectedTransitions,
      async (expected) => {
        // Find matching existing transition by both fromStateId and toStateId
        const existing = existingTransitions.find(
          (transition) =>
            transition.fromStateId === expected.fromStateId &&
            transition.toStateId === expected.toStateId,
        );

        if (existing) {
          // If transition is already completed, don't update it (results phase is locked)
          if (existing.completedAt) {
            return { action: 'skipped' as const };
          }

          // Update the scheduled date if it changed (compare as timestamps to handle format differences)
          if (new Date(existing.scheduledDate).getTime() !== new Date(expected.scheduledDate).getTime()) {
            await db
              .update(decisionProcessTransitions)
              .set({
                scheduledDate: expected.scheduledDate,
              })
              .where(eq(decisionProcessTransitions.id, existing.id));

            return { action: 'updated' as const };
          }

          return { action: 'unchanged' as const };
        } else {
          // Create new transition for this phase
          await db.insert(decisionProcessTransitions).values({
            processInstanceId: processInstance.id,
            fromStateId: expected.fromStateId,
            toStateId: expected.toStateId,
            scheduledDate: expected.scheduledDate,
          });

          return { action: 'created' as const };
        }
      },
      { concurrency: 5 },
    );

    // Aggregate results
    result.updated = updateResults.filter((update) => update.action === 'updated').length;
    result.created = updateResults.filter((update) => update.action === 'created').length;

    // Delete transitions that are no longer in the expected set
    // But only delete uncompleted transitions
    // Use composite key (fromStateId:toStateId) to match both fields
    const expectedTransitionKeys = new Set(
      expectedTransitions.map((transition) => `${transition.fromStateId}:${transition.toStateId}`),
    );
    const transitionsToDelete = existingTransitions.filter(
      (transition) =>
        !expectedTransitionKeys.has(`${transition.fromStateId}:${transition.toStateId}`) &&
        !transition.completedAt,
    );

    await pMap(
      transitionsToDelete,
      async (transition) => {
        await db
          .delete(decisionProcessTransitions)
          .where(eq(decisionProcessTransitions.id, transition.id));
      },
      { concurrency: 5 },
    );

    result.deleted = transitionsToDelete.length;

    return result;
  } catch (error) {
    if (error instanceof CommonError) {
      throw error;
    }
    console.error('Error updating transitions for process:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new CommonError(
      `Failed to update process transitions: ${errorMessage}`,
    );
  }
}
