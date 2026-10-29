import { type DbClient, db as defaultDb } from '@op/db/client';
import { decisionProcessTransitions } from '@op/db/schema';
import type { ProcessInstance } from '@op/db/schema';
import { logger } from '@op/logging';

import { CommonError } from '../../utils';
import { buildExpectedTransitions } from './buildExpectedTransitions';
import { withInstancePhases } from './readInstancePhases';

/**
 * Creates scheduled transition records for phases with date-based advancement.
 * Each transition fires when the current phase's end date arrives.
 *
 * Rules are read from the instance's phase data (instanceData.phases[].rules),
 * which are populated from the template when the instance is created.
 */
export async function createTransitionsForProcess({
  processInstance,
  db = defaultDb,
  fromRows,
}: {
  processInstance: ProcessInstance;
  db?: DbClient;
  /** Pass it in when holding the instance lock. */
  fromRows?: boolean;
}): Promise<{
  transitions: Array<{
    id: string;
    fromStateId: string | null;
    toStateId: string;
    scheduledDate: Date;
  }>;
}> {
  try {
    const transitionsToCreate = buildExpectedTransitions(
      await withInstancePhases({ instance: processInstance, db, fromRows }),
    );

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
