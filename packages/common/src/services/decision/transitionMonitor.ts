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

    // Batch-fetch all process schemas in one query so the per-instance loop
    // doesn't N+1 the decisionProcesses table.
    const processIds = [
      ...new Set(
        dueTransitions
          .map((t) => t.instance.processId)
          .filter((id): id is string => id !== null),
      ),
    ];
    const processRows = processIds.length
      ? await db
          .select({
            id: decisionProcesses.id,
            processSchema: decisionProcesses.processSchema,
          })
          .from(decisionProcesses)
          .where(inArray(decisionProcesses.id, processIds))
      : [];
    const schemasByProcessId = new Map<string, ProcessSchema | undefined>(
      processRows.map((row) => [
        row.id,
        row.processSchema as ProcessSchema | undefined,
      ]),
    );

    // Group transitions by processInstanceId so each instance is processed
    // sequentially. The optimistic lock inside advancePhase already prevents
    // double-processing across workers; sequential per-instance ordering
    // keeps phase progression correct within a single worker.
    const transitionsByProcess = new Map<string, typeof dueTransitions>();

    for (const transition of dueTransitions) {
      const existing = transitionsByProcess.get(transition.processInstanceId);
      if (existing) {
        existing.push(transition);
      } else {
        transitionsByProcess.set(transition.processInstanceId, [transition]);
      }
    }

    await pMap(
      Array.from(transitionsByProcess.entries()),
      async ([processInstanceId, transitions]) => {
        // Per-instance setup wrapped in try/catch so malformed instanceData
        // is recorded as a per-transition error rather than escaping pMap
        // and bombing the whole batch.
        let processSchema: ProcessSchema | undefined;
        let lastPhaseId: string;
        try {
          const processId = transitions[0]!.instance.processId;
          processSchema = processId
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
          lastPhaseId = phases[phases.length - 1]!.phaseId;
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
          return;
        }

        let lastSuccessfulToStateId: string | null = null;

        for (const transition of transitions) {
          try {
            const advanceResult = await db.transaction(async (tx) =>
              advancePhase({
                tx,
                instance: {
                  id: processInstanceId,
                  processId: transition.instance.processId,
                  instanceData: transition.instance.instanceData,
                },
                processSchema,
                fromPhaseId: transition.fromStateId!,
                toPhaseId: transition.toStateId,
                triggeredByProfileId: null,
                transitionData: {},
                now,
              }),
            );

            if (advanceResult.conflict) {
              // Another worker beat us, or the instance left PUBLISHED.
              // Stop advancing this instance.
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

            console.error(
              `Failed to process transition ${transition.id}:`,
              error,
            );

            // Stop processing this instance's transitions on error
            break;
          }
        }

        if (lastSuccessfulToStateId === lastPhaseId) {
          try {
            console.log(
              `Processing results for process instance ${processInstanceId}`,
            );

            const processingResult = await processResults({
              processInstanceId,
            });

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
            // The transition to the results phase has already been committed,
            // so a results-processing failure is logged but does not fail the
            // overall cron run.
            console.error(
              `Error processing results for process instance ${processInstanceId}:`,
              error,
            );
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
