import { db } from '@op/db/client';

import { type DecisionInstanceData, advancePhase } from '../../src';

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
  });
  if (!processInstance) {
    throw new Error(`Instance ${instanceId} not found`);
  }
  return db.transaction((tx) =>
    advancePhase({
      db: tx,
      instance: {
        ...processInstance,
        instanceData: processInstance.instanceData as DecisionInstanceData,
      },
      fromPhaseId,
      toPhaseId,
      triggeredByProfileId: null,
    }),
  );
}
