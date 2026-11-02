import { db } from '@op/db/client';

import { advancePhase, readInstancePhases } from '../../src';

export async function advanceInstancePhase({
  instanceId,
  fromPhaseId,
  toPhaseId,
}: {
  instanceId: string;
  fromPhaseId: string;
  toPhaseId: string;
}) {
  return db.transaction(async (tx) =>
    advancePhase({
      db: tx,
      instance: { id: instanceId },
      phases: await readInstancePhases({
        db: tx,
        processInstanceId: instanceId,
      }),
      fromPhaseId,
      toPhaseId,
      triggeredByProfileId: null,
    }),
  );
}
