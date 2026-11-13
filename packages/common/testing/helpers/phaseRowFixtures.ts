import { db } from '@op/db/client';
import { processInstances } from '@op/db/schema';
import { eq, sql } from 'drizzle-orm';

// TODO: remove when instanceData.phases is dropped.
export const emptyBlobPhases = (instanceId: string) =>
  db
    .update(processInstances)
    .set({
      instanceData: sql`jsonb_set(${processInstances.instanceData}, '{phases}', '[]')`,
    })
    .where(eq(processInstances.id, instanceId));
