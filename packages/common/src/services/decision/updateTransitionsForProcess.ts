import { type TransactionType, db, eq } from '@op/db/client';
import { decisionProcessTransitions } from '@op/db/schema';
import type { ProcessInstance } from '@op/db/schema';
import pMap from 'p-map';

import { CommonError } from '../../utils';
import type { DecisionInstanceData } from './schemas/instanceData';
import type { ScheduledTransition } from './types';

export interface UpdateTransitionsInput {
  processInstance: ProcessInstance;
  tx?: TransactionType;
}

export interface UpdateTransitionsResult {
  updated: number;
  created: number;
  deleted: number;
}

/**
 * Updates transition records for a process instance when phase dates change.
 * Only handles phases with date-based advancement (rules.advancement.method === 'date').
 * This function:
 * - Updates existing transitions with new scheduled dates
 * - Creates new transitions for newly added date-based phases
 * - Deletes transitions for phases that no longer use date-based advancement
 * - Prevents updates to completed transitions (results phase is locked)
 */
export async function updateTransitionsForProcess({
  processInstance,
  tx,
}: UpdateTransitionsInput): Promise<UpdateTransitionsResult> {
  const dbClient = tx ?? db;

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
      await dbClient._query.decisionProcessTransitions.findMany({
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

    // Build expected transitions for phases with date-based advancement
    // A transition is created FROM a phase (when it ends) TO the next phase
    const expectedTransitions: ScheduledTransition[] = [];

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
      expectedTransitions.push({
        processInstanceId: processInstance.id,
        fromStateId: currentPhase.phaseId,
        toStateId: nextPhase.phaseId,
        scheduledDate: new Date(scheduledDate).toISOString(),
      });
    });

    // Calculate transitions to delete upfront (those not in expected set and not completed)
    // Use composite key (fromStateId:toStateId) to match both fields
    const expectedTransitionKeys = new Set(
      expectedTransitions.map(
        (transition) => `${transition.fromStateId}:${transition.toStateId}`,
      ),
    );
    const transitionsToDelete = existingTransitions.filter(
      (transition) =>
        !expectedTransitionKeys.has(
          `${transition.fromStateId}:${transition.toStateId}`,
        ) && !transition.completedAt,
    );

    // Run update/create and delete operations in parallel since they operate on mutually exclusive sets
    const [updateResults] = await Promise.all([
      // Update existing transitions or create new ones
      pMap(
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
            if (
              new Date(existing.scheduledDate).getTime() !==
              new Date(expected.scheduledDate).getTime()
            ) {
              await dbClient
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
            await dbClient.insert(decisionProcessTransitions).values({
              processInstanceId: expected.processInstanceId,
              fromStateId: expected.fromStateId,
              toStateId: expected.toStateId,
              scheduledDate: expected.scheduledDate,
            });

            return { action: 'created' as const };
          }
        },
        { concurrency: 5 },
      ),
      // Delete transitions that are no longer in the expected set
      pMap(
        transitionsToDelete,
        async (transition) => {
          await dbClient
            .delete(decisionProcessTransitions)
            .where(eq(decisionProcessTransitions.id, transition.id));
        },
        { concurrency: 5 },
      ),
    ]);

    // Aggregate results
    result.updated = updateResults.filter(
      (update) => update.action === 'updated',
    ).length;
    result.created = updateResults.filter(
      (update) => update.action === 'created',
    ).length;
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
