import { db, eq, lte, sql } from '@op/db/client';
import {
  decisionProcessTransitions,
  decisionProcesses,
  processInstances,
} from '@op/db/schema';
import pMap from 'p-map';

import { CommonError } from '../../utils';
import { processResults } from './processResults';
import type { ProcessSchema, StateDefinition } from './types';

export interface ProcessDecisionsTransitionsResult {
  processed: number;
  failed: number;
  errors: Array<{
    transitionId: string;
    processInstanceId: string;
    error: string;
  }>;
}

/**
 * Monitors and processes transitions that are due.
 * This function is called by an external service either scheduled or on a cron job.
 */
export async function processDecisionsTransitions(): Promise<ProcessDecisionsTransitionsResult> {
  const now = new Date().toISOString();
  const result: ProcessDecisionsTransitionsResult = {
    processed: 0,
    failed: 0,
    errors: [],
  };

  try {
    const dueTransitions = await db.query.decisionProcessTransitions.findMany({
      where: (transitions, { and, isNull }) =>
        and(
          isNull(transitions.completedAt),
          lte(transitions.scheduledDate, now),
        ),
      orderBy: (transitions, { asc }) => [asc(transitions.scheduledDate)],
    });

    // Group transitions by processInstanceId to avoid race conditions
    // within the same process instance
    const transitionsByProcess = new Map<string, typeof dueTransitions>();

    for (const transition of dueTransitions) {
      const processTransitions = transitionsByProcess.get(
        transition.processInstanceId,
      );
      if (processTransitions) {
        processTransitions.push(transition);
      } else {
        transitionsByProcess.set(transition.processInstanceId, [transition]);
      }
    }

    // Process each process instance's transitions in parallel (up to 4 processes at a time)
    // but process transitions WITHIN each process sequentially to prevent race conditions per process
    await pMap(
      Array.from(transitionsByProcess.entries()),
      async ([_processInstanceId, transitions]) => {
        // Process this process's transitions sequentially
        for (const transition of transitions) {
          try {
            await processTransition(transition.id);

            result.processed++;
          } catch (error) {
            result.failed++;

            result.errors.push({
              transitionId: transition.id,
              processInstanceId: transition.processInstanceId,
              error: error instanceof Error ? error.message : 'Unknown error',
            });

            console.error(
              `Failed to process transition ${transition.id}:`,
              error,
            );
          }
        }
      },
      { concurrency: 4 },
    );

    return result;
  } catch (error) {
    console.error('Error in processDueTransitions:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new CommonError(`Failed to process due transitions: ${errorMessage}`);
  }
}

/**
 * Processes a single transition by ID.
 * Updates the process instance state to move to the next phase.
 * If transitioning to a final state (results phase), triggers results processing.
 */
async function processTransition(transitionId: string): Promise<void> {
  const transition = await db.query.decisionProcessTransitions.findFirst({
    where: eq(decisionProcessTransitions.id, transitionId),
  });

  if (!transition) {
    throw new CommonError(
      `Transition not found: ${transitionId}. It may have been deleted or the ID is invalid.`,
    );
  }

  if (transition.completedAt) {
    return;
  }

  // Get the process instance to check if we're transitioning to a final state
  const processInstance = await db.query.processInstances.findFirst({
    where: eq(processInstances.id, transition.processInstanceId),
  });

  if (!processInstance) {
    throw new CommonError(
      `Process instance not found: ${transition.processInstanceId}`,
    );
  }

  // Get the process schema to check the state type
  const process = await db.query.decisionProcesses.findFirst({
    where: eq(decisionProcesses.id, processInstance.processId),
  });

  if (!process) {
    throw new CommonError(`Process not found: ${processInstance.processId}`);
  }

  const processSchema = process.processSchema as ProcessSchema;
  const toState = processSchema.states.find(
    (state: StateDefinition) => state.id === transition.toStateId,
  );

  const isTransitioningToFinalState = toState?.type === 'final';

  // Update both the process instance and transition in a single transaction
  // to ensure atomicity and prevent partial state updates
  // Note: We rely on foreign key constraints to ensure the process instance exists
  await db.transaction(async (tx) => {
    // Update the process instance to the new state
    // Use jsonb_set to update only the currentStateId field without reading the entire instanceData
    await tx
      .update(processInstances)
      .set({
        currentStateId: transition.toStateId,
        instanceData: sql`jsonb_set(
          ${processInstances.instanceData},
          '{currentStateId}',
          to_jsonb(${transition.toStateId}::text)
        )`,
      })
      .where(eq(processInstances.id, transition.processInstanceId));

    // Mark the transition as completed
    await tx
      .update(decisionProcessTransitions)
      .set({
        completedAt: new Date().toISOString(),
      })
      .where(eq(decisionProcessTransitions.id, transition.id));
  });

  // If transitioning to a final state (results phase), process the results
  // This is done AFTER the transition is marked complete to ensure the state change
  // is committed even if results processing fails
  if (isTransitioningToFinalState) {
    try {
      console.log(
        `Processing results for process instance ${transition.processInstanceId}`,
      );
      const result = await processResults({
        processInstanceId: transition.processInstanceId,
      });

      if (!result.success) {
        console.error(
          `Results processing failed for process instance ${transition.processInstanceId}:`,
          result.error,
        );
      } else {
        console.log(
          `Results processed successfully for process instance ${transition.processInstanceId}. Selected ${result.selectedProposalIds.length} proposals.`,
        );
      }
    } catch (error) {
      // Log the error but don't fail the transition
      // The transition to the results phase has already been completed
      console.error(
        `Error processing results for process instance ${transition.processInstanceId}:`,
        error,
      );
    }
  }
}
