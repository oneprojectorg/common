import { db, eq } from '@op/db/client';
import { decisionProcesses, processInstances, users } from '@op/db/schema';
import { User } from '@op/supabase/lib';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import type { InstanceData, ProcessSchema } from './types';

export interface CreateInstanceInput {
  processId: string;
  name: string;
  description?: string;
  instanceData: InstanceData;
}

export const createInstance = async ({
  data,
  user,
}: {
  data: CreateInstanceInput;
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

    // Verify the process exists
    const process = await db.query.decisionProcesses.findFirst({
      where: eq(decisionProcesses.id, data.processId),
    });

    if (!process) {
      throw new NotFoundError('Decision process not found');
    }

    // Get initial state from process schema
    const processSchema = process.processSchema as ProcessSchema;
    const initialStateId =
      processSchema.initialState || processSchema.states?.[0]?.id;

    const [instance] = await db
      .insert(processInstances)
      .values({
        processId: data.processId,
        name: data.name,
        description: data.description,
        instanceData: data.instanceData,
        currentStateId: initialStateId,
        ownerProfileId: dbUser.currentProfileId,
        status: 'draft',
      })
      .returning();

    if (!instance) {
      throw new CommonError('Failed to create process instance');
    }

    return instance;
  } catch (error) {
    if (
      error instanceof UnauthorizedError ||
      error instanceof NotFoundError ||
      error instanceof CommonError
    ) {
      throw error;
    }
    console.error('Error creating process instance:', error);
    throw new CommonError('Failed to create process instance');
  }
};
