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
import {
  type InstanceWithPhases,
  resolvePhases,
  resolvePhasesForAll,
} from './instancePhases';
import { onPhaseAdvanced } from './onPhaseAdvanced';

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

type InstanceTransitions = {
  id: string;
  instanceData: unknown;
  transitions: DueTransition[];
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

    const instances = await resolvePhasesForAll({
      instances: groupTransitionsByInstance(dueTransitions),
    });

    await pMap(
      instances,
      async (instance) => {
        const { id: processInstanceId, transitions } = instance;

        if (instance.phases.length === 0) {
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
          instance,
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
): InstanceTransitions[] {
  const transitionsByInstance = new Map<string, InstanceTransitions>();

  for (const transition of dueTransitions) {
    const existing = transitionsByInstance.get(transition.processInstanceId);
    if (existing) {
      existing.transitions.push(transition);
    } else {
      transitionsByInstance.set(transition.processInstanceId, {
        id: transition.processInstanceId,
        instanceData: transition.instance.instanceData,
        transitions: [transition],
      });
    }
  }

  return [...transitionsByInstance.values()];
}

/**
 * Advance one instance's transitions sequentially. Stops on conflict or error.
 * Returns the last successfully reached phase ID, or null if nothing advanced.
 */
async function advanceInstanceTransitions({
  instance,
  transitions,
  now,
  result,
}: {
  instance: InstanceWithPhases<{ id: string; instanceData: unknown }>;
  transitions: DueTransition[];
  now: string;
  result: ProcessDecisionsTransitionsResult;
}): Promise<void> {
  const processInstanceId = instance.id;
  let current = instance;

  for (const transition of transitions) {
    try {
      if (!transition.fromStateId) {
        throw new CommonError(`Transition ${transition.id} has no fromStateId`);
      }
      const fromPhaseId = transition.fromStateId;

      // Only auto-advance phases with date-based advancement.
      const departingPhase = current.phases.find(
        (p) => p.phaseId === fromPhaseId,
      );
      if (departingPhase?.rules?.advancement?.method !== 'date') {
        continue;
      }

      const advanceResult = await db.transaction(async (tx) =>
        advancePhase({
          db: tx,
          instance: current,
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
      // instance snapshot directly. The loop below re-fetches the row for the
      // next iteration; the cache invalidation keeps external readers fresh.
      await invalidateDecisionInstance(processInstanceId);

      await onPhaseAdvanced({
        instanceId: processInstanceId,
        fromPhaseId,
        toPhaseId: transition.toStateId,
        phases: current.phases,
        advanceResult,
      });

      // Re-fetch so the next iteration sees the committed state.
      const refreshed = await db.query.processInstances.findFirst({
        where: { id: processInstanceId },
      });
      if (refreshed) {
        current = await resolvePhases({ instance: refreshed });
      }
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
