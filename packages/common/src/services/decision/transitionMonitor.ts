import { and, db, eq, isNull, lte } from '@op/db/client';
import {
  ProcessStatus,
  decisionProcessTransitions,
  processInstances,
} from '@op/db/schema';
import { logger } from '@op/logging';
import pMap from 'p-map';

import { CommonError } from '../../utils';
import { advancePhase } from './advancePhase';
import { invalidateDecisionInstance } from './decisionCache';
import { onPhaseAdvanced } from './onPhaseAdvanced';
import { listInstancePhases, readInstancePhases } from './readInstancePhases';
import type { PhaseInstanceData } from './schemas/instanceData';

export interface ProcessDecisionsTransitionsResult {
  processed: number;
  failed: number;
  errors: Array<{
    transitionId: string;
    processInstanceId: string;
    error: string;
  }>;
}

/** Joined due-transition row shape. */
type DueTransition = {
  id: string;
  processInstanceId: string;
  fromStateId: string | null;
  toStateId: string;
  scheduledDate: string;
  completedAt: string | null;
};

/**
 * Process all due scheduled transitions. Called by cron.
 * Delegates each transition to `advancePhase`.
 */
export async function processDecisionsTransitions({
  processInstanceId,
  now = new Date().toISOString(),
}: {
  processInstanceId?: string;
  now?: string;
} = {}): Promise<ProcessDecisionsTransitionsResult> {
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
          processInstanceId
            ? eq(
                decisionProcessTransitions.processInstanceId,
                processInstanceId,
              )
            : undefined,
        ),
      )
      .orderBy(decisionProcessTransitions.scheduledDate);

    if (dueTransitions.length === 0) {
      return result;
    }

    const transitionsByInstance = groupTransitionsByInstance(dueTransitions);
    // One rows query for the whole sweep.
    const phasesByInstance = await listInstancePhases({
      db,
      processInstanceIds: [...transitionsByInstance.keys()],
    });

    await pMap(
      transitionsByInstance,
      async ([processInstanceId, transitions]) => {
        const phases = phasesByInstance.get(processInstanceId) ?? [];

        if (phases.length === 0) {
          for (const transition of transitions) {
            result.failed++;
            result.errors.push({
              transitionId: transition.id,
              processInstanceId,
              error: `Process instance ${processInstanceId} has no phases`,
            });
          }
          return;
        }

        await advanceInstanceTransitions({
          processInstanceId,
          phases,
          transitions,
          now,
          result,
        });
      },
      { concurrency: 5 },
    );

    return result;
  } catch (error) {
    logger.error('Error in processDueTransitions', { error });
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new CommonError(`Failed to process due transitions: ${errorMessage}`);
  }
}

/** Group transitions by instance so each instance's phases advance sequentially. */
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
 * Advance one instance's transitions sequentially. Stops on conflict or error.
 * Returns the last successfully reached phase ID, or null if nothing advanced.
 */
async function advanceInstanceTransitions({
  processInstanceId,
  phases: sweepPhases,
  transitions,
  now,
  result,
}: {
  processInstanceId: string;
  phases: PhaseInstanceData[];
  transitions: DueTransition[];
  now: string;
  result: ProcessDecisionsTransitionsResult;
}): Promise<void> {
  let phases = sweepPhases;

  for (const transition of transitions) {
    try {
      if (!transition.fromStateId) {
        throw new CommonError(`Transition ${transition.id} has no fromStateId`);
      }
      const fromPhaseId = transition.fromStateId;

      // Only auto-advance phases with date-based advancement.
      const departingPhase = phases.find((p) => p.phaseId === fromPhaseId);
      if (departingPhase?.rules?.advancement?.method !== 'date') {
        continue;
      }

      const advanceResult = await db.transaction(async (tx) =>
        advancePhase({
          db: tx,
          instance: { id: processInstanceId },
          phases,
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

      result.processed++;

      // Cron-driven advance: no router runs here, so invalidate the cached
      // instance snapshot directly. The loop below re-reads the phases for the
      // next iteration; the cache invalidation keeps external readers fresh.
      await invalidateDecisionInstance(processInstanceId);

      await onPhaseAdvanced({
        instanceId: processInstanceId,
        fromPhaseId,
        toPhaseId: transition.toStateId,
        phases,
        advanceResult,
      });

      // Re-read so the next iteration sees the committed state.
      phases = await readInstancePhases({ db, processInstanceId });
    } catch (error) {
      result.failed++;
      result.errors.push({
        transitionId: transition.id,
        processInstanceId: transition.processInstanceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      logger.error('Failed to process transition', {
        transitionId: transition.id,
        error,
      });
      break;
    }
  }
}
