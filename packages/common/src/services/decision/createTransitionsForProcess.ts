import { type DbClient, db as defaultDb } from '@op/db/client';
import { decisionProcessTransitions } from '@op/db/schema';
import { logger } from '@op/logging';

import { CommonError } from '../../utils';
import { buildExpectedTransitions } from './buildExpectedTransitions';
import type { PhaseInstanceData } from './schemas/instanceData';

/**
 * Creates scheduled transition records for phases with date-based advancement.
 * Each transition fires when the current phase's end date arrives.
 */
export async function createTransitionsForProcess({
  processInstanceId,
  phases,
  db = defaultDb,
}: {
  processInstanceId: string;
  phases: readonly PhaseInstanceData[];
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
    const transitionsToCreate = buildExpectedTransitions({
      processInstanceId,
      phases,
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
