import { db, eq } from '@op/db/client';
import { decisionProcesses, users } from '@op/db/schema';
import { User } from '@op/supabase/lib';

import { CommonError, UnauthorizedError } from '../../utils';
import type { ProcessSchema } from './types';

export interface CreateProcessInput {
  name: string;
  description?: string;
  processSchema: ProcessSchema;
}

export const createProcess = async ({
  data,
  user,
}: {
  data: CreateProcessInput;
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

    const [process] = await db
      .insert(decisionProcesses)
      .values({
        name: data.name,
        description: data.description,
        processSchema: data.processSchema,
        createdByProfileId: dbUser.currentProfileId,
      })
      .returning();

    if (!process) {
      throw new CommonError('Failed to create decision process');
    }

    return process;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    console.error('Error creating decision process:', error);
    throw new CommonError('Failed to create decision process');
  }
};
