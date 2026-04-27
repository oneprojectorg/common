import { type DbClient, db as defaultDb, eq } from '@op/db/client';
import { processInstances } from '@op/db/schema';

/**
 * Pure predicate over an `instanceData` JSON value.
 *
 * A process instance is "legacy" if its `instanceData` JSON contains a
 * `currentStateId` field. Legacy instances stored current state in the JSON
 * blob; new instances never write it there (they use the row column instead).
 */
export function isLegacyInstanceData(instanceData: unknown): boolean {
  if (instanceData == null || typeof instanceData !== 'object') {
    return false;
  }

  const data = instanceData as { currentStateId?: string };
  return data.currentStateId != null;
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
  db: DbClient = defaultDb,
): Promise<boolean> {
  const [row] = await db
    .select({ instanceData: processInstances.instanceData })
    .from(processInstances)
    .where(eq(processInstances.id, instanceId))
    .limit(1);

  if (!row) {
    return false;
  }

  return isLegacyInstanceData(row.instanceData);
}
