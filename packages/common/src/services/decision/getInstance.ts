import { db, eq } from '@op/db/client';
import { processInstances } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { getCurrentOrgId, getOrgAccessUser } from '../access';

export interface GetInstanceInput {
  instanceId: string;
  user: User;
}

export const getInstance = async ({ instanceId, user }: GetInstanceInput) => {
  if (!user) {
    throw new UnauthorizedError('User must be authenticated');
  }

  // ASSERT VIEW ACCESS ON ORGUSER
  const orgUserId = await getCurrentOrgId({ database: db });
  const orgUser = await getOrgAccessUser({
    user,
    organizationId: orgUserId,
  });

  assertAccess({ decisions: permission.READ }, orgUser?.roles ?? []);

  try {
    const instance = await db.query.processInstances.findFirst({
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

    // Calculate proposal and participant counts
    const proposalCount = instance.proposals?.length || 0;
    const uniqueParticipants = new Set(
      instance.proposals?.map((p) => p.submittedByProfileId),
    );
    const participantCount = uniqueParticipants.size;

    return {
      ...instance,
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
