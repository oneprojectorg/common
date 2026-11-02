import { type DbClient, eq, sql } from '@op/db/client';
import { processInstances } from '@op/db/schema';

import { lockProcessInstanceOrThrow } from './lockProcessInstance';
import {
  type DecisionPhase,
  listPhases,
  toPhaseInstanceData,
} from './phaseHelpers';

// Everything here writes `instance_data.phases`; the file goes with the blob.

/**
 * Locks the decision, hands its phases to `mutate`, then mirrors the rows onto
 * `instance_data.phases` so the builder's next save lists them.
 */
export const mutatePhases = async <T>({
  db,
  processInstanceId,
  mutate,
}: {
  db: DbClient;
  processInstanceId: string;
  mutate: (stored: { phases: DecisionPhase[] }) => Promise<T>;
}): Promise<{ result: T; phases: DecisionPhase[] }> => {
  await lockProcessInstanceOrThrow({ db, instanceId: processInstanceId });
  const phases = await listPhases({ db, processInstanceId });

  const result = await mutate({ phases });

  const written = await listPhases({ db, processInstanceId });
  const mirrored = written.map(toPhaseInstanceData);
  await db
    .update(processInstances)
    .set({
      instanceData: sql`jsonb_set(${processInstances.instanceData}, '{phases}', ${JSON.stringify(mirrored)}::jsonb)`,
    })
    .where(eq(processInstances.id, processInstanceId));

  return { result, phases: written };
};
