import { db, eq } from '@op/db/client';
import { processInstances } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { getProfileAccessUser } from '../access';
import type { DecisionInstanceData } from './schemas/instanceData';

export interface GetInstanceInput {
  instanceId: string;
  authUserId: string;
  user: User;
}

export const getInstance = async ({ instanceId, user }: GetInstanceInput) => {
  try {
    const instance = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instanceId),
      with: {
        process: true,
        owner: true,
        proposals: {
          columns: {
            id: true,
            submittedByProfileId: true,
          },
        },
      },
    });

    if (!instance) {
      throw new NotFoundError('Process instance not found');
    }

    if (!instance.profileId) {
      throw new NotFoundError(
        'Process instance does not have an associated profile',
      );
    }

    // Assert view access via profileUser on the instance's profile
    const profileUser = await getProfileAccessUser({
      user,
      profileId: instance.profileId,
    });

    assertAccess({ profile: permission.READ }, profileUser?.roles ?? []);

    // Calculate proposal and participant counts
    const proposalCount = instance.proposals?.length || 0;
    const uniqueParticipants = new Set(
      instance.proposals?.map((p) => p.submittedByProfileId),
    );
    const participantCount = uniqueParticipants.size;

    // Filter budget from phase settings if hideBudget is true
    const instanceData = instance.instanceData as DecisionInstanceData;
    const filteredInstanceData = instanceData.config?.hideBudget
      ? {
          ...instanceData,
          phases: instanceData.phases.map((phase) => ({
            ...phase,
            settings: phase.settings
              ? { ...phase.settings, budget: undefined }
              : phase.settings,
          })),
        }
      : instanceData;

    return {
      ...instance,
      instanceData: filteredInstanceData,
      proposalCount,
      participantCount,
    };
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof UnauthorizedError) {
      throw error;
    }
    console.error('Error fetching process instance:', error);
    throw new NotFoundError('Process instance not found');
  }
};
