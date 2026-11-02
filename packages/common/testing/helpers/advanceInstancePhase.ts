import { db } from '@op/db/client';

import { advancePhase, getInstancePhases, withInstancePhases } from '../../src';

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
  const { instanceData } = await withInstancePhases({
    instance: processInstance,
  });
  return db.transaction((tx) =>
    advancePhase({
      db: tx,
      instance: {
        id: processInstance.id,
        instanceData: { phases: [...getInstancePhases(instanceData)] },
      },
      fromPhaseId,
      toPhaseId,
      triggeredByProfileId: null,
    }),
  );
}
