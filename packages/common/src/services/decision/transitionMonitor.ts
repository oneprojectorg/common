import { and, db, eq, isNull, lte } from '@op/db/client';
import {
  ProcessStatus,
  decisionProcessTransitions,
  processInstances,
} from '@op/db/schema';
import { Events, event } from '@op/events';
import pMap from 'p-map';

import { CommonError } from '../../utils';
import { advancePhase } from './advancePhase';
import { runResultsProcessing } from './runResultsProcessing';
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
  now,
  result,
}: {
  processInstanceId: string;
  transitions: DueTransition[];
  now: string;
  result: ProcessDecisionsTransitionsResult;
}): Promise<string | null> {
  let lastSuccessfulToStateId: string | null = null;
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

      // Enqueue the phase-transition event after the transaction commits
      // so the notification is only sent on a successful advance.
      // Non-fatal: the phase advance already committed; a notification failure
      // should not abort further transitions for this instance.
      try {
        await event.send({
          name: Events.phaseTransitioned.name,
          data: {
            processInstanceId,
            fromPhaseId,
            toPhaseId: transition.toStateId,
            triggeredByProfileId: null,
          },
        });
      } catch (notifyError) {
        console.error(
          `Failed to send phase transition event for transition ${transition.id}:`,
          notifyError,
        );
        // Continue processing further transitions — the phase advance succeeded.
      }

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

  return lastSuccessfulToStateId;
}
