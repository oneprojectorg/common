import { db, eq } from '@op/db/client';
import { organizations, processInstances } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { getOrgAccessUser } from '../access';

export interface GetInstanceInput {
  instanceId: string;
  authUserId: string;
  user: User;
}

export const getInstance = async ({ instanceId, user }: GetInstanceInput) => {
  if (!user) {
    throw new UnauthorizedError('User must be authenticated');
  }

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

    const instanceOrg = await db
      .select({
        id: organizations.id,
      })
      .from(organizations)
      .where(eq(organizations.profileId, instance.ownerProfileId))
      .limit(1);

    if (!instanceOrg[0]) {
      throw new NotFoundError('Organization not found');
    }

    // ASSERT VIEW ACCESS ON ORGUSER
    const orgUser = await getOrgAccessUser({
      user,
      organizationId: instanceOrg[0].id,
    });

    assertAccess({ decisions: permission.READ }, orgUser?.roles ?? []);

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
