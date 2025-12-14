import { db } from '@op/db/client';
import type { DecisionProcess, ProcessInstance } from '@op/db/schema';

import { NotFoundError } from '../../utils';

type AssertProcessInstanceParams = {
  id: string;
  ownerProfileId?: string;
};

/**
 * Fetches a process instance and throws if not found.
 * Can look up by:
 * - id only
 * - id + ownerProfileId (verifies the instance belongs to the specified owner)
 *
 * @throws NotFoundError if process instance is not found
 */
export async function assertProcessInstance(
  params: AssertProcessInstanceParams,
): Promise<ProcessInstance> {
  const { id, ownerProfileId } = params;

  const processInstance = await db.query.processInstances.findFirst({
    where: (table, { eq, and }) => {
      if (ownerProfileId) {
        return and(eq(table.id, id), eq(table.ownerProfileId, ownerProfileId));
      }
      return eq(table.id, id);
    },
  });

  if (!processInstance) {
    throw new NotFoundError('ProcessInstance', id);
  }

  return processInstance;
}

type ProcessInstanceWithProcess = ProcessInstance & {
  process: DecisionProcess;
};

/**
 * Fetches a process instance with its associated decision process and throws if not found.
 * Use this when you need both the instance and its process schema.
 *
 * @throws NotFoundError if process instance is not found
 */
export async function assertProcessInstanceWithProcess({
  id,
}: {
  id: string;
}): Promise<ProcessInstanceWithProcess> {
  const processInstance = await db.query.processInstances.findFirst({
    where: (table, { eq }) => eq(table.id, id),
    with: {
      process: true,
    },
  });

  if (!processInstance || !processInstance.process) {
    throw new NotFoundError('ProcessInstance', id);
  }

  return processInstance as ProcessInstanceWithProcess;
}
