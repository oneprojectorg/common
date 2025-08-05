import { db, eq } from '@op/db/client';
import { decisionProcesses, users } from '@op/db/schema';
import { User } from '@op/supabase/lib';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import type { ProcessSchema } from './types';

export interface UpdateProcessInput {
  name?: string;
  description?: string;
  processSchema?: ProcessSchema;
}

export const updateProcess = async ({
  processId,
  data,
  user,
}: {
  processId: string;
  data: UpdateProcessInput;
  user: User;
}) => {
  if (!user) {
    throw new UnauthorizedError('User must be authenticated');
  }

  try {
    // Get the database user record to access currentProfileId
    const dbUser = await db.query.users.findFirst({
      where: eq(users.authUserId, user.id),
    });

    if (!dbUser || !dbUser.currentProfileId) {
      throw new UnauthorizedError('User must have an active profile');
    }

    // Check if process exists and user has permission to update it
    const existingProcess = await db.query.decisionProcesses.findFirst({
      where: eq(decisionProcesses.id, processId),
    });

    if (!existingProcess) {
      throw new NotFoundError('Decision process not found');
    }

    if (existingProcess.createdByProfileId !== dbUser.currentProfileId) {
      throw new UnauthorizedError('Not authorized to update this process');
    }

    const [updatedProcess] = await db
      .update(decisionProcesses)
      .set({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(decisionProcesses.id, processId))
      .returning();

    if (!updatedProcess) {
      throw new CommonError('Failed to update decision process');
    }

    return updatedProcess;
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof NotFoundError) {
      throw error;
    }
    console.error('Error updating decision process:', error);
    throw new CommonError('Failed to update decision process');
  }
};
