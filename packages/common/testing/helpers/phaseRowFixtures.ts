import { db } from '@op/db/client';
import { processInstances, processPhases, profiles } from '@op/db/schema';
import { eq, sql } from 'drizzle-orm';

/** Empties `instanceData.phases`, leaving the rows as the only record of them. */
export const emptyBlobPhases = (instanceId: string) =>
  db
    .update(processInstances)
    .set({
      instanceData: sql`jsonb_set(${processInstances.instanceData}, '{phases}', '[]')`,
    })
    .where(eq(processInstances.id, instanceId));

/**
 * Names every row "Row <phaseId>", merges `rowData` into its data and empties
 * the blob phases, so only the rows can answer a phase read.
 */
export const leaveOnlyPhaseRows = async (
  instanceId: string,
  rowData: Record<string, unknown> = {},
): Promise<void> => {
  await db
    .update(processPhases)
    .set({
      data: sql`${processPhases.data} || ${JSON.stringify(rowData)}::jsonb`,
    })
    .where(eq(processPhases.processInstanceId, instanceId));
  await db
    .update(profiles)
    .set({ name: sql`'Row ' || (${processPhases.data} ->> 'phaseId')` })
    .from(processPhases)
    .where(
      sql`${profiles.id} = ${processPhases.profileId} AND ${processPhases.processInstanceId} = ${instanceId}`,
    );
  await emptyBlobPhases(instanceId);
};
