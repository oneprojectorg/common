import { db } from '@op/db/client';

import { advancePhase, getInstancePhases } from '../../src';

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
  return db.transaction((tx) =>
    advancePhase({
      db: tx,
      instance: {
        id: processInstance.id,
        instanceData: {
          phases: [...getInstancePhases(processInstance.instanceData)],
        },
      },
      fromPhaseId,
      toPhaseId,
      triggeredByProfileId: null,
    }),
  );
}
