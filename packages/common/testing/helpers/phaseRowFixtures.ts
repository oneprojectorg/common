import { db } from '@op/db/client';
import { processInstances } from '@op/db/schema';
import { eq, sql } from 'drizzle-orm';

import { getInstancePhases } from '../../src';
import {
  listPhases,
  reconcilePhases,
} from '../../src/services/decision/phaseHelpers';

export const loadPhaseRows = (processInstanceId: string) =>
  listPhases({ db, processInstanceId });

// TODO: remove when instanceData.phases is dropped.
export const emptyBlobPhases = (instanceId: string) =>
  db
    .update(processInstances)
    .set({
      instanceData: sql`jsonb_set(${processInstances.instanceData}, '{phases}', '[]')`,
    })
    .where(eq(processInstances.id, instanceId));

// Brings an instance's phase rows, if it has any, in line with an edited instanceData.phases.
// Pass `phases` when the caller just wrote them; otherwise they are read back.
export const syncPhaseRows = async (
  instanceId: string,
  phases?: readonly unknown[],
): Promise<void> => {
  const target =
    phases === undefined
      ? await readBlobPhases(instanceId)
      : getInstancePhases({ phases });

  await db.transaction(async (tx) => {
    const existing = await listPhases({
      db: tx,
      processInstanceId: instanceId,
    });
    if (existing.length === 0) {
      return;
    }
    await reconcilePhases({
      tx,
      processInstanceId: instanceId,
      existing,
      phases: target,
    });
  });
};

const readBlobPhases = async (instanceId: string) => {
  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
    columns: { instanceData: true },
  });
  if (!instance) {
    throw new Error(`Instance ${instanceId} not found`);
  }
  return getInstancePhases(instance.instanceData);
};
