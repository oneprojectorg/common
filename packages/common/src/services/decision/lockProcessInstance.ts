import { type DbClient, eq } from '@op/db/client';
import { processInstances } from '@op/db/schema';

export type LockedProcessInstance = Pick<
  typeof processInstances.$inferSelect,
  'currentStateId' | 'status' | 'instanceData'
>;

/**
 * Takes a row-level lock on the instance and returns its phase-relevant
 * columns, or undefined if the row is gone.
 *
 * Every writer that moves an instance between phases (`advancePhase`,
 * `submitManualSelection`, `revertPhase`) takes this lock first and re-reads
 * the state inside it, so concurrent transitions serialize instead of acting
 * on a snapshot that changed underneath them.
 */
export async function lockProcessInstance({
  db,
  instanceId,
}: {
  db: DbClient;
  instanceId: string;
}): Promise<LockedProcessInstance | undefined> {
  const [locked] = await db
    .select({
      currentStateId: processInstances.currentStateId,
      status: processInstances.status,
      instanceData: processInstances.instanceData,
    })
    .from(processInstances)
    .where(eq(processInstances.id, instanceId))
    .limit(1)
    .for('update');

  return locked;
}
