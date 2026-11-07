import { type DbClient, db as defaultDb } from '@op/db/client';
import { decisionProcessTransitions } from '@op/db/schema';
import type { ProcessInstance } from '@op/db/schema';
import { logger } from '@op/logging';

import { CommonError } from '../../utils';
import { buildExpectedTransitions } from './buildExpectedTransitions';
import { attachPhaseRows } from './instancePhases';
import {
  type ProcessPhaseWithProfile,
  listPhases,
  resolveTransitionPhaseRowIds,
} from './phaseHelpers';

/**
 * Creates scheduled transition records for phases with date-based advancement.
 * Each transition fires when the current phase's end date arrives.
 *
 * Rules are read from the instance's phase rows.
 */
export async function createTransitionsForProcess({
  processInstance,
  phases,
  db = defaultDb,
}: {
  processInstance: ProcessInstance;
  // Read here when the caller does not hold the rows.
  phases?: ProcessPhaseWithProfile[];
  db?: DbClient;
}): Promise<{
  transitions: Array<{
    id: string;
    fromStateId: string | null;
    toStateId: string;
    scheduledDate: Date;
  }>;
}> {
  try {
    const rows =
      phases ??
      (await listPhases({ db, processInstanceId: processInstance.id }));
    const transitionsToCreate = resolveTransitionPhaseRowIds({
      phases: rows,
      transitions: buildExpectedTransitions(
        attachPhaseRows({ instance: processInstance, phases: rows }),
      ),
    });

    if (transitionsToCreate.length === 0) {
      return { transitions: [] };
    }

    const createdTransitions = await db
      .insert(decisionProcessTransitions)
      .values(transitionsToCreate)
      .returning();

    return {
      transitions: createdTransitions.map((transition) => ({
        id: transition.id,
        fromStateId: transition.fromStateId,
        toStateId: transition.toStateId,
        scheduledDate: new Date(transition.scheduledDate),
      })),
    };
  } catch (error) {
    if (error instanceof CommonError) {
      throw error;
    }
    logger.error('Error creating transitions for process', { error });
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new CommonError(
      `Failed to create process transitions: ${errorMessage}`,
    );
  }
}
