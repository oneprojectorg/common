import { db, eq } from '@op/db/client';
import { processInstances } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { z } from 'zod';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import { getCurrentProfileId } from '../access';
import type { InstanceData } from './types';

export interface UpdateInstanceInput {
  instanceId: string;
  name?: string;
  description?: string;
  instanceData?: InstanceData;
  status?: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
}

// Zod schema for the update data (excluding instanceId)
const updateDataSchema = z
  .object({
    name: z.string().min(3).max(256).optional(),
    description: z.string().optional(),
    instanceData: z.any().optional(), // Using any for now since InstanceData is a complex type
    status: z
      .enum(['draft', 'active', 'paused', 'completed', 'cancelled'])
      .optional(),
  })
  .strip() // Remove any extra fields
  .transform((data) => {
    // Remove undefined fields for cleaner database updates
    return Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined),
    );
  });

export const updateInstance = async ({
  data,
  user,
}: {
  data: UpdateInstanceInput;
  user: User;
}) => {
  if (!user) {
    throw new UnauthorizedError('User must be authenticated');
  }

  try {
    const currentProfileId = await getCurrentProfileId();

    if (!currentProfileId) {
      throw new UnauthorizedError('User must have an active profile');
    }

    // Verify the instance exists and user has permission
    const existingInstance = await db.query.processInstances.findFirst({
      where: eq(processInstances.id, data.instanceId),
    });

    if (!existingInstance) {
      throw new NotFoundError('Process instance not found');
    }

    // TODO: Only owners can edit at the moment. You an broaden this to admins with assertAccess
    if (existingInstance.ownerProfileId !== currentProfileId) {
      throw new UnauthorizedError(
        'You do not have permission to update this process instance',
      );
    }

    const updateData = updateDataSchema.parse(data);

    const [updatedInstance] = await db
      .update(processInstances)
      .set(updateData)
      .where(eq(processInstances.id, data.instanceId))
      .returning();

    if (!updatedInstance) {
      throw new CommonError('Failed to update decision process instance');
    }

    return updatedInstance;
  } catch (error) {
    if (
      error instanceof UnauthorizedError ||
      error instanceof NotFoundError ||
      error instanceof CommonError
    ) {
      throw error;
    }
    console.error('Error updating process instance:', error);
    throw new CommonError('Failed to update process instance');
  }
};
