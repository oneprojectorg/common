import { db, eq } from '@op/db/client';
import type { DbClient } from '@op/db/client';
import { processInstances } from '@op/db/schema';

/**
 * Shape of the legacy/new fields inside `processInstances.instanceData`.
 * Legacy instances store `currentStateId`; new instances store `currentPhaseId`.
 */
type InstanceDataLegacyFields = {
  currentPhaseId?: string;
  currentStateId?: string;
};

/**
 * Pure predicate over an `instanceData` JSON value.
 *
 * A process instance is "legacy" if its `instanceData` JSON has `currentStateId`
 * but no `currentPhaseId`. New instances always write `currentPhaseId`; old
 * instances (predating the join-table-backed phase scoping) only have
 * `currentStateId`. Use this when you already have the JSON in hand.
 */
export function isLegacyInstanceData(instanceData: unknown): boolean {
  if (instanceData == null || typeof instanceData !== 'object') {
    return false;
  }

  const data = instanceData as InstanceDataLegacyFields;
  return data.currentPhaseId == null && data.currentStateId != null;
}

/**
 * Reads `instanceData` for the given instance and returns whether it is a
 * legacy instance. Returns `false` if the instance does not exist.
 *
 * Prefer `isLegacyInstanceData` if you already have the JSON loaded — this
 * variant exists for callers that only have an instance ID.
 */
export async function isLegacyInstance(
  instanceId: string,
  dbClient: DbClient = db,
): Promise<boolean> {
  const [row] = await dbClient
    .select({ instanceData: processInstances.instanceData })
    .from(processInstances)
    .where(eq(processInstances.id, instanceId))
    .limit(1);

  if (!row) {
    return false;
  }

  return isLegacyInstanceData(row.instanceData);
}
