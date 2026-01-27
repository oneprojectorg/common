import { and, db, eq, isNull, lte, sql } from '@op/db/client';
import {
  type DecisionProcess,
  type DecisionProcessTransition,
  type ProcessInstance,
  ProcessStatus,
  decisionProcessTransitions,
  processInstances,
} from '@op/db/schema';
import pMap from 'p-map';

import { CommonError } from '../../utils';
// import { processResults } from './processResults';
import type { DecisionInstanceData } from './schemas/instanceData';

/** Transition with nested process instance and process relations */
type TransitionWithRelations = DecisionProcessTransition & {
  processInstance: ProcessInstance & {
    process: DecisionProcess;
  };
};

/** Result of processing a single transition */
interface ProcessedTransition {
  toStateId: string;
  isTransitioningToFinalState: boolean;
  processInstanceId: string;
}

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
    // Query due transitions, filtering to only include published instances
    // Draft, completed, and cancelled instances should not have their transitions processed
    const dueTransitions = await db
      .select({
        id: decisionProcessTransitions.id,
        processInstanceId: decisionProcessTransitions.processInstanceId,
        fromStateId: decisionProcessTransitions.fromStateId,
        toStateId: decisionProcessTransitions.toStateId,
        scheduledDate: decisionProcessTransitions.scheduledDate,
        completedAt: decisionProcessTransitions.completedAt,
      })
      .from(decisionProcessTransitions)
      .innerJoin(
        processInstances,
        eq(decisionProcessTransitions.processInstanceId, processInstances.id),
      )
      .where(
        and(
          isNull(decisionProcessTransitions.completedAt),
          lte(decisionProcessTransitions.scheduledDate, now),
          eq(processInstances.status, ProcessStatus.PUBLISHED),
        ),
      )
      .orderBy(decisionProcessTransitions.scheduledDate);

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

    // Process each process instance's transitions in parallel (up to 5 processes at a time)
    // but process transitions WITHIN each process sequentially to prevent race conditions per process
    await pMap(
      Array.from(transitionsByProcess.entries()),
      async ([processInstanceId, transitions]) => {
        let lastSuccessfulTransition: ProcessedTransition | null = null;

        // Process this process's transitions sequentially
        for (const transition of transitions) {
          try {
            // Process transition (marks completedAt, returns state info)
            lastSuccessfulTransition = await processTransition(transition.id);
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

            // Stop processing this instance's transitions on error
            break;
          }
        }

        // Update instance state to the last successfully processed transition
        if (lastSuccessfulTransition) {
          await updateInstanceState(
            processInstanceId,
            lastSuccessfulTransition.toStateId,
          );

          // Trigger results processing if transitioning to final state
          if (lastSuccessfulTransition.isTransitioningToFinalState) {
            try {
              console.log(
                `Processing results for process instance ${processInstanceId}`,
              );
              console.log('RESULT PROCESSING DISABLED');
              // Disabling for now as none are defined in production yet. We need to migrate current processes first.
              /*
              const result = await processResults({
                processInstanceId,
              });

              if (!result.success) {
                console.error(
                  `Results processing failed for process instance ${processInstanceId}:`,
                  result.error,
                );
              } else {
                console.log(
                  `Results processed successfully for process instance ${processInstanceId}. Selected ${result.selectedProposalIds.length} proposals.`,
                );
              }
              */
            } catch (error) {
              // Log the error but don't fail the transition
              // The transition to the results phase has already been completed
              console.error(
                `Error processing results for process instance ${processInstanceId}:`,
                error,
              );
            }
          }
        }
      },
      { concurrency: 5 },
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
 * Marks the transition as completed and returns info needed for state update.
 * The actual instance state update happens after all transitions are processed.
 */
async function processTransition(
  transitionId: string,
): Promise<ProcessedTransition> {
  // Fetch transition with related process instance and process in a single query
  const transitionResult = await db._query.decisionProcessTransitions.findFirst(
    {
      where: eq(decisionProcessTransitions.id, transitionId),
      with: {
        processInstance: {
          with: {
            process: true,
          },
        },
      },
    },
  );

  if (!transitionResult) {
    throw new CommonError(
      `Transition not found: ${transitionId}. It may have been deleted or the ID is invalid.`,
    );
  }

  // Type assertion for the nested relations (Drizzle's type inference doesn't handle nested `with` well)
  const transition = transitionResult as TransitionWithRelations;

  const processInstance = transition.processInstance;
  if (!processInstance) {
    throw new CommonError(
      `Process instance not found: ${transition.processInstanceId}`,
    );
  }

  const process = processInstance.process;
  if (!process) {
    throw new CommonError(`Process not found: ${processInstance.processId}`);
  }

  // Determine if transitioning to final state using instanceData.phases
  // In the new schema format, the last phase is always the final state
  const instanceData = processInstance.instanceData as DecisionInstanceData;
  const phases = instanceData.phases;
  const lastPhaseId = phases[phases.length - 1]?.phaseId;
  const isTransitioningToFinalState = transition.toStateId === lastPhaseId;

  // Only mark the transition as completed (state update happens after all transitions)
  await db
    .update(decisionProcessTransitions)
    .set({
      completedAt: new Date().toISOString(),
    })
    .where(eq(decisionProcessTransitions.id, transitionId));

  // Return info needed for state update
  return {
    toStateId: transition.toStateId,
    isTransitioningToFinalState,
    processInstanceId: transition.processInstanceId,
  };
}

/**
 * Updates the process instance state to the specified state.
 * Called after all transitions for an instance have been processed.
 */
async function updateInstanceState(
  processInstanceId: string,
  toStateId: string,
): Promise<void> {
  await db
    .update(processInstances)
    .set({
      currentStateId: toStateId,
      instanceData: sql`jsonb_set(
        ${processInstances.instanceData},
        '{currentPhaseId}',
        to_jsonb(${toStateId}::text)
      )`,
    })
    .where(eq(processInstances.id, processInstanceId));
}
