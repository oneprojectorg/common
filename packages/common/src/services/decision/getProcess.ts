import { db, eq } from '@op/db/client';
import { decisionProcesses } from '@op/db/schema';

import { NotFoundError } from '../../utils';

export const getProcess = async (processId: string) => {
  try {
    const process = await db._query.decisionProcesses.findFirst({
      where: eq(decisionProcesses.id, processId),
      with: {
        createdBy: true,
      },
    });

    if (!process) {
      throw new NotFoundError('Decision process not found');
    }

    return process;
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    console.error('Error fetching decision process:', error);
    throw new NotFoundError('Decision process not found');
  }
};
