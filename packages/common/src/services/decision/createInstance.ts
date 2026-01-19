import { db, eq } from '@op/db/client';
import {
  EntityType,
  ProcessStatus,
  decisionProcesses,
  processInstances,
  profiles,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import { assertUserByAuthId } from '../assert';
import { generateUniqueProfileSlug } from '../profile/utils';
import { createTransitionsForProcess } from './createTransitionsForProcess';
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
  try {
    const dbUser = await assertUserByAuthId(user.id);

    const ownerProfileId = dbUser.currentProfileId ?? dbUser.profileId;

    if (!ownerProfileId) {
      throw new UnauthorizedError('User must have an active profile');
    }

    // Verify the process exists
    const process = await db._query.decisionProcesses.findFirst({
      where: eq(decisionProcesses.id, data.processId),
    });

    if (!process) {
      throw new NotFoundError('Decision process not found');
    }

    // Get initial state from process schema
    const processSchema = process.processSchema as ProcessSchema;
    const initialStateId =
      processSchema.initialState || processSchema.states?.[0]?.id || undefined;

    const instance = await db.transaction(async (tx) => {
      // Generate a unique slug for the profile
      const slug = await generateUniqueProfileSlug({
        name: `decision-${data.name}`,
        db: tx,
      });

      // Create a profile for the decision process instance
      const [instanceProfile] = await tx
        .insert(profiles)
        .values({
          type: EntityType.DECISION,
          name: data.name,
          slug,
        })
        .returning();

      if (!instanceProfile) {
        throw new CommonError('Failed to create decision instance profile');
      }

      const [newInstance] = await tx
        .insert(processInstances)
        .values({
          processId: data.processId,
          name: data.name,
          description: data.description,
          instanceData: data.instanceData,
          currentStateId: initialStateId,
          ownerProfileId,
          profileId: instanceProfile.id,
          status: ProcessStatus.DRAFT,
        })
        .returning();

      if (!newInstance) {
        throw new CommonError('Failed to create decision process instance');
      }

      return newInstance;
    });

    // Create transitions for the process phases
    // This is critical - if transitions can't be created, the process won't auto-advance
    await createTransitionsForProcess({ processInstance: instance });

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
