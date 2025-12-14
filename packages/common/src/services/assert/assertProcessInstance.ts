import { db } from '@op/db/client';
import { type ProcessInstance } from '@op/db/schema';

import { NotFoundError } from '../../utils';

/**
 * Fetches a process instance and throws if not found.
 *
 * @throws NotFoundError if process instance is not found
 */
export async function assertProcessInstance({
  id,
}: {
  id: string;
}): Promise<ProcessInstance> {
  const processInstance = await db.query.processInstances.findFirst({
    where: (table, { eq }) => eq(table.id, id),
  });

  if (!processInstance) {
    throw new NotFoundError('ProcessInstance', id);
  }

  return processInstance;
}
