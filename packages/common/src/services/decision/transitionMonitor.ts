import { and, db, eq, isNull, lte } from '@op/db/client';
import {
  ProcessStatus,
  decisionProcessTransitions,
  processInstances,
} from '@op/db/schema';
import pMap from 'p-map';

import { CommonError } from '../../utils';
import { advancePhase } from './advancePhase';
import { processResults } from './processResults';
import type { DecisionInstanceData } from './schemas/instanceData';

export interface ProcessDecisionsTransitionsResult {
  processed: number;
  failed: number;
  errors: Array<{
    transitionId: string;
    processInstanceId: string;
    error: string;
  }>;
}

/** Shape of the joined due-transition rows returned by the initial query. */
type DueTransition = {
  id: string;
  processInstanceId: string;
  fromStateId: string | null;
  toStateId: string;
  scheduledDate: string;
  completedAt: string | null;
  instance: {
    instanceData: unknown;
  };
};

/**
 * Monitors and processes transitions that are due. Called by an external
 * scheduler / cron worker.
 *
 * Each due transition is delegated to the shared `advancePhase` core, so the
 * cron path writes stateTransitionHistory rows, runs the departing phase's
 * selection pipeline, and persists surviving proposals into
 * decisionTransitionProposals — matching the manual transition path.
 */
export async function processDecisionsTransitions(): Promise<ProcessDecisionsTransitionsResult> {
  const now = new Date().toISOString();
  const result: ProcessDecisionsTransitionsResult = {
    processed: 0,
    failed: 0,
    errors: [],
  };

  try {
    const dueTransitions = await db
      .select({
        id: decisionProcessTransitions.id,
        processInstanceId: decisionProcessTransitions.processInstanceId,
        fromStateId: decisionProcessTransitions.fromStateId,
        toStateId: decisionProcessTransitions.toStateId,
        scheduledDate: decisionProcessTransitions.scheduledDate,
        completedAt: decisionProcessTransitions.completedAt,
        instance: {
          instanceData: processInstances.instanceData,
        },
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

    if (dueTransitions.length === 0) {
      return result;
    }

    const transitionsByInstance = groupTransitionsByInstance(dueTransitions);

    await pMap(
      Array.from(transitionsByInstance.entries()),
      async ([processInstanceId, transitions]) => {
        const instanceData = transitions[0]!.instance
          .instanceData as DecisionInstanceData;
        const phases = instanceData.phases;

        if (!phases || phases.length === 0) {
          for (const transition of transitions) {
            result.failed++;
            result.errors.push({
              transitionId: transition.id,
              processInstanceId,
              error: `Process instance ${processInstanceId} has no phases defined in instanceData`,
            });
          }
          return;
        }

        const lastPhaseId = phases[phases.length - 1]!.phaseId;

        const lastSuccessfulToStateId = await advanceInstanceTransitions({
          processInstanceId,
          transitions,
          now,
          result,
        });

        if (lastSuccessfulToStateId === lastPhaseId) {
          await runResultsProcessing(processInstanceId);
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
 * Groups due transitions by processInstanceId so each instance's transitions
 * can be processed sequentially. The optimistic lock inside advancePhase
 * prevents double-processing across workers; sequential per-instance ordering
 * keeps phase progression correct within a single worker.
 */
function groupTransitionsByInstance(
  dueTransitions: DueTransition[],
): Map<string, DueTransition[]> {
  const transitionsByInstance = new Map<string, DueTransition[]>();

  for (const transition of dueTransitions) {
    const existing = transitionsByInstance.get(transition.processInstanceId);
    if (existing) {
      existing.push(transition);
    } else {
      transitionsByInstance.set(transition.processInstanceId, [transition]);
    }
  }

  return transitionsByInstance;
}

/**
 * Processes one instance's transitions sequentially via advancePhase, each
 * in its own transaction. Stops on conflict (another worker beat us) or
 * error, recording per-transition failures on the result.
 *
 * Returns the last successfully reached phase ID, or null if nothing advanced.
 */
async function advanceInstanceTransitions({
  processInstanceId,
  transitions,
  now,
  result,
}: {
  processInstanceId: string;
  transitions: DueTransition[];
  now: string;
  result: ProcessDecisionsTransitionsResult;
}): Promise<string | null> {
  let lastSuccessfulToStateId: string | null = null;
  // Start with the snapshot from the initial query. After each successful
  // advance, re-fetch so the next iteration's pipeline sees the updated
  // instanceData (currentPhaseId, stateData, etc.).
  let currentInstanceData: unknown = transitions[0]!.instance.instanceData;

  for (const transition of transitions) {
    try {
      if (!transition.fromStateId) {
        throw new CommonError(`Transition ${transition.id} has no fromStateId`);
      }
      const fromPhaseId = transition.fromStateId;

      const advanceResult = await db.transaction(async (tx) =>
        advancePhase({
          tx,
          instance: {
            id: processInstanceId,
            instanceData: currentInstanceData,
          },
          fromPhaseId,
          toPhaseId: transition.toStateId,
          triggeredByProfileId: null,
          transitionData: {},
          now,
        }),
      );

      if (advanceResult.conflict) {
        break;
      }

      lastSuccessfulToStateId = transition.toStateId;
      result.processed++;

      // Re-fetch instanceData so the next transition's pipeline sees
      // the committed state (updated currentPhaseId, stateData, etc.)
      const refreshed = await db._query.processInstances.findFirst({
        where: eq(processInstances.id, processInstanceId),
      });
      if (refreshed) {
        currentInstanceData = refreshed.instanceData;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({
        transitionId: transition.id,
        processInstanceId: transition.processInstanceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      console.error(`Failed to process transition ${transition.id}:`, error);
      break;
    }
  }

  return lastSuccessfulToStateId;
}

/**
 * Runs the selection pipeline / results processing for an instance that has
 * reached its final phase. The phase transition has already committed, so
 * failures here are logged but do not fail the overall cron run.
 */
async function runResultsProcessing(processInstanceId: string): Promise<void> {
  try {
    console.log(`Processing results for process instance ${processInstanceId}`);

    const processingResult = await processResults({ processInstanceId });

    if (!processingResult.success) {
      console.error(
        `Results processing failed for process instance ${processInstanceId}:`,
        processingResult.error,
      );
    } else {
      console.log(
        `Results processed successfully for process instance ${processInstanceId}. Selected ${processingResult.selectedProposalIds.length} proposals.`,
      );
    }
  } catch (error) {
    console.error(
      `Error processing results for process instance ${processInstanceId}:`,
      error,
    );
  }
}
