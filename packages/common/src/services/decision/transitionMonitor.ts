import { and, db, eq, isNull, lte } from '@op/db/client';
import {
  ProcessStatus,
  decisionProcessTransitions,
  processInstances,
} from '@op/db/schema';
import pMap from 'p-map';

import { CommonError } from '../../utils';
import { advancePhase } from './advancePhase';
import { onPhaseAdvanced } from './onPhaseAdvanced';
import type {
  DecisionInstanceData,
  PhaseInstanceData,
} from './schemas/instanceData';

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
  instance: {
    instanceData: unknown;
  };
};

/**
 * Process all due scheduled transitions. Called by cron.
 * Delegates each transition to `advancePhase`.
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

        await advanceInstanceTransitions({
          processInstanceId,
          transitions,
          phases,
          now,
          result,
        });
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
  transitions,
  phases,
  now,
  result,
}: {
  processInstanceId: string;
  transitions: DueTransition[];
  phases: PhaseInstanceData[];
  now: string;
  result: ProcessDecisionsTransitionsResult;
}): Promise<void> {
  let currentInstanceData = transitions[0]!.instance
    .instanceData as DecisionInstanceData;

  for (const transition of transitions) {
    try {
      if (!transition.fromStateId) {
        throw new CommonError(`Transition ${transition.id} has no fromStateId`);
      }
      const fromPhaseId = transition.fromStateId;

      // Only auto-advance phases with date-based advancement.
      const departingPhase = currentInstanceData.phases?.find(
        (p) => p.phaseId === fromPhaseId,
      );
      if (departingPhase?.rules?.advancement?.method !== 'date') {
        continue;
      }

      const advanceResult = await db.transaction(async (tx) =>
        advancePhase({
          db: tx,
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

      result.processed++;

      await onPhaseAdvanced({
        instanceId: processInstanceId,
        fromPhaseId,
        toPhaseId: transition.toStateId,
        phases,
        advanceResult,
      });

      // Re-fetch so the next iteration sees the committed state.
      const refreshed = await db.query.processInstances.findFirst({
        where: { id: processInstanceId },
      });
      if (refreshed) {
        currentInstanceData = refreshed.instanceData as DecisionInstanceData;
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
}
