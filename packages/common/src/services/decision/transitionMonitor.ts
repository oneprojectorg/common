import { and, db, eq, inArray, isNull, lte } from '@op/db/client';
import {
  ProcessStatus,
  decisionProcessTransitions,
  decisionProcesses,
  processInstances,
} from '@op/db/schema';
import pMap from 'p-map';

import { CommonError } from '../../utils';
import { advancePhase } from './advancePhase';
import { processResults } from './processResults';
import type { DecisionInstanceData } from './schemas/instanceData';
import type { ProcessSchema } from './types';

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
    processId: string | null;
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
          processId: processInstances.processId,
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

    const schemasByProcessId = await loadProcessSchemas(dueTransitions);
    const transitionsByProcess = groupTransitionsByInstance(dueTransitions);

    await pMap(
      Array.from(transitionsByProcess.entries()),
      async ([processInstanceId, transitions]) => {
        const context = resolveTransitionContext(
          processInstanceId,
          transitions,
          schemasByProcessId,
          result,
        );
        if (!context) {
          return;
        }

        const lastSuccessfulToStateId = await advanceInstanceTransitions({
          processInstanceId,
          transitions,
          processSchema: context.processSchema,
          now,
          result,
        });

        if (lastSuccessfulToStateId === context.lastPhaseId) {
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
 * Batch-fetches process schemas for all distinct processIds in the due
 * transitions, returning a Map for O(1) lookup in the per-instance loop.
 * Avoids N+1 queries against decisionProcesses.
 */
async function loadProcessSchemas(
  dueTransitions: DueTransition[],
): Promise<Map<string, ProcessSchema | undefined>> {
  const processIds = [
    ...new Set(
      dueTransitions
        .map((t) => t.instance.processId)
        .filter((id): id is string => id !== null),
    ),
  ];

  if (processIds.length === 0) {
    return new Map();
  }

  const processRows = await db
    .select({
      id: decisionProcesses.id,
      processSchema: decisionProcesses.processSchema,
    })
    .from(decisionProcesses)
    .where(inArray(decisionProcesses.id, processIds));

  return new Map(
    processRows.map((row) => [
      row.id,
      row.processSchema as ProcessSchema | undefined,
    ]),
  );
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
  const transitionsByProcess = new Map<string, DueTransition[]>();

  for (const transition of dueTransitions) {
    const existing = transitionsByProcess.get(transition.processInstanceId);
    if (existing) {
      existing.push(transition);
    } else {
      transitionsByProcess.set(transition.processInstanceId, [transition]);
    }
  }

  return transitionsByProcess;
}

/**
 * Resolves the process schema and final phase for an instance. Records any
 * setup failure (malformed instanceData, missing phases) as a per-transition
 * error on the result so the batch can continue with other instances, and
 * returns null to signal the caller to skip this instance.
 */
function resolveTransitionContext(
  processInstanceId: string,
  transitions: DueTransition[],
  schemasByProcessId: Map<string, ProcessSchema | undefined>,
  result: ProcessDecisionsTransitionsResult,
): { processSchema: ProcessSchema | undefined; lastPhaseId: string } | null {
  try {
    const processId = transitions[0]!.instance.processId;
    const processSchema = processId
      ? schemasByProcessId.get(processId)
      : undefined;

    const instanceData = transitions[0]!.instance
      .instanceData as DecisionInstanceData;
    const phases = instanceData.phases;
    if (!phases || phases.length === 0) {
      throw new CommonError(
        `Process instance ${processInstanceId} has no phases defined in instanceData`,
      );
    }
    const lastPhaseId = phases[phases.length - 1]!.phaseId;

    return { processSchema, lastPhaseId };
  } catch (error) {
    for (const transition of transitions) {
      result.failed++;
      result.errors.push({
        transitionId: transition.id,
        processInstanceId: transition.processInstanceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    console.error(
      `Failed to set up transitions for instance ${processInstanceId}:`,
      error,
    );
    return null;
  }
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
  processSchema,
  now,
  result,
}: {
  processInstanceId: string;
  transitions: DueTransition[];
  processSchema: ProcessSchema | undefined;
  now: string;
  result: ProcessDecisionsTransitionsResult;
}): Promise<string | null> {
  let lastSuccessfulToStateId: string | null = null;

  for (const transition of transitions) {
    try {
      if (!transition.fromStateId) {
        throw new CommonError(
          `Transition ${transition.id} has no fromStateId`,
        );
      }

      const advanceResult = await db.transaction(async (tx) =>
        advancePhase({
          tx,
          instance: {
            id: processInstanceId,
            processId: transition.instance.processId,
            instanceData: transition.instance.instanceData,
          },
          processSchema,
          fromPhaseId: transition.fromStateId,
          toPhaseId: transition.toStateId,
          triggeredByProfileId: null,
          transitionData: {},
          now,
        }),
      );

      if (advanceResult.conflict) {
        // Another worker beat us, or the instance left PUBLISHED.
        break;
      }

      lastSuccessfulToStateId = transition.toStateId;
      result.processed++;
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
    console.log(
      `Processing results for process instance ${processInstanceId}`,
    );

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
