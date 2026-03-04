import { type TransactionType, db, eq, inArray } from '@op/db/client';
import { decisionProcessTransitions } from '@op/db/schema';
import type { ProcessInstance } from '@op/db/schema';

import { CommonError } from '../../utils';
import { buildExpectedTransitions } from './buildExpectedTransitions';

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
    const expectedTransitions = buildExpectedTransitions(processInstance);

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

    // Partition expected transitions into updates and creates
    const toCreate: typeof expectedTransitions = [];
    const toUpdate: { id: string; scheduledDate: string }[] = [];

    for (const expected of expectedTransitions) {
      const existing = existingTransitions.find(
        (transition) =>
          transition.fromStateId === expected.fromStateId &&
          transition.toStateId === expected.toStateId,
      );

      if (existing) {
        // If transition is already completed, don't update it (results phase is locked)
        if (existing.completedAt) {
          continue;
        }

        // Update the scheduled date if it changed
        if (existing.scheduledDate !== expected.scheduledDate) {
          toUpdate.push({
            id: existing.id,
            scheduledDate: expected.scheduledDate,
          });
        }
      } else {
        toCreate.push(expected);
      }
    }

    // Execute all DB operations concurrently
    const ops: Promise<void>[] = [];

    // Batch delete
    if (transitionsToDelete.length > 0) {
      const idsToDelete = transitionsToDelete.map((t) => t.id);
      ops.push(
        dbClient
          .delete(decisionProcessTransitions)
          .where(inArray(decisionProcessTransitions.id, idsToDelete))
          .then(() => {}),
      );
    }

    // Batch insert
    if (toCreate.length > 0) {
      ops.push(
        dbClient
          .insert(decisionProcessTransitions)
          .values(toCreate)
          .then(() => {}),
      );
    }

    // Updates must remain individual (different values per row)
    for (const update of toUpdate) {
      ops.push(
        dbClient
          .update(decisionProcessTransitions)
          .set({ scheduledDate: update.scheduledDate })
          .where(eq(decisionProcessTransitions.id, update.id))
          .then(() => {}),
      );
    }

    await Promise.all(ops);

    result.updated = toUpdate.length;
    result.created = toCreate.length;
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
