import { db } from '@op/db/client';

import { NotFoundError } from '../../utils';

export const getProcess = async (processId: string) => {
  try {
    const process = await db.query.decisionProcesses.findFirst({
      where: { id: processId },
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
