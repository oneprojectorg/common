import { db, eq } from '@op/db/client';
import { decisionProcessTransitions } from '@op/db/schema';
import type { ProcessInstance } from '@op/db/schema';
import pMap from 'p-map';

import { CommonError } from '../../utils';
import type { InstanceData, PhaseConfiguration } from './types';

export interface UpdateTransitionsInput {
  processInstance: ProcessInstance;
}

export interface UpdateTransitionsResult {
  updated: number;
  created: number;
  deleted: number;
}

/**
 * Updates transition records for a process instance when phase dates change.
 * This function:
 * - Updates existing transitions with new scheduled dates
 * - Creates new transitions for newly added phases
 * - Deletes transitions for removed phases
 * - Prevents updates to completed transitions (results phase is locked)
 */
export async function updateTransitionsForProcess({
  processInstance,
}: UpdateTransitionsInput): Promise<UpdateTransitionsResult> {
  try {
    const instanceData = processInstance.instanceData as InstanceData;
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

    const result: UpdateTransitionsResult = {
      updated: 0,
      created: 0,
      deleted: 0,
    };

    // Build a map of expected transitions from the current phases
    const expectedTransitions = phases.map(
      (phase: PhaseConfiguration, index: number) => {
        const fromStateId = index > 0 ? phases[index - 1]?.phaseId : null;
        const toStateId = phase.phaseId;
        // For phases like 'results' that only have a start date (no end), use the start date
        const scheduledDate = phase.plannedEndDate || phase.plannedStartDate;

        if (!scheduledDate) {
          throw new CommonError(
            `Phase ${index + 1} (${toStateId}) must have either a scheduled end date or start date`,
          );
        }

        return {
          fromStateId,
          toStateId,
          scheduledDate: new Date(scheduledDate).toISOString(),
        };
      },
    );

    // Process each expected transition in parallel
    const updateResults = await pMap(
      expectedTransitions,
      async (expected) => {
        // Find matching existing transition by toStateId
        const existing = existingTransitions.find(
          (t) => t.toStateId === expected.toStateId,
        );

        if (existing) {
          // If transition is already completed, don't update it (results phase is locked)
          if (existing.completedAt) {
            return { action: 'skipped' as const };
          }

          // Update the scheduled date if it changed
          if (existing.scheduledDate !== expected.scheduledDate) {
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
    result.updated = updateResults.filter((r) => r.action === 'updated').length;
    result.created = updateResults.filter((r) => r.action === 'created').length;

    // Delete transitions that are no longer in the phases list
    // But only delete uncompleted transitions
    const expectedStateIds = new Set(
      expectedTransitions.map((t) => t.toStateId),
    );
    const transitionsToDelete = existingTransitions.filter(
      (t) => !expectedStateIds.has(t.toStateId) && !t.completedAt,
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
