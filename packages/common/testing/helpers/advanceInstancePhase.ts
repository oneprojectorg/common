import { db } from '@op/db/client';

import { advancePhase, resolvePhases } from '../../src';

export async function advanceInstancePhase({
  instanceId,
  fromPhaseId,
  toPhaseId,
}: {
  instanceId: string;
  fromPhaseId: string;
  toPhaseId: string;
}) {
  const processInstance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
    columns: { id: true, instanceData: true },
  });
  if (!processInstance) {
    throw new Error(`Instance ${instanceId} not found`);
  }
  const instance = await resolvePhases({ instance: processInstance });
  return db.transaction((tx) =>
    advancePhase({
      db: tx,
      instance,
      fromPhaseId,
      toPhaseId,
      triggeredByProfileId: null,
    }),
  );
}
