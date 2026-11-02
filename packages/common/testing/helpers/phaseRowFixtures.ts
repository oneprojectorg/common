import { db } from '@op/db/client';
import { processInstances, processPhases, profiles } from '@op/db/schema';
import { eq, sql } from 'drizzle-orm';

// TODO: remove these fixtures when instanceData.phases is dropped.

export const emptyBlobPhases = (instanceId: string) =>
  db
    .update(processInstances)
    .set({
      instanceData: sql`jsonb_set(${processInstances.instanceData}, '{phases}', '[]')`,
    })
    .where(eq(processInstances.id, instanceId));

/** Names each row "Row <phaseId>" so a test can tell a row read from a blob read. */
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
