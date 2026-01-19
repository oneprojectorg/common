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
  try {
    const instance = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instanceId),
      with: {
        process: true,
        owner: true,
        profile: true, // Decision profile for /decisions/[slug] navigation
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
      console.error('Could not find organization for process instance', {
        orgProfileId: organizations.profileId,
        instanceOwnerProfileId: instance.ownerProfileId,
      });
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

    // Extract decision profile slug for /decisions/[slug] navigation
    const profileSlug = (instance.profile as { slug?: string } | null)?.slug;

    // Filter budget if hideBudget is true (for all users, including owner)
    const instanceData = instance.instanceData as any;
    const shouldHideBudget = instanceData?.hideBudget === true;

    const filteredInstanceData = shouldHideBudget
      ? { ...instanceData, budget: undefined }
      : instanceData;

    return {
      ...instance,
      instanceData: filteredInstanceData,
      proposalCount,
      participantCount,
      profileSlug,
    };
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof UnauthorizedError) {
      throw error;
    }
    console.error('Error fetching process instance:', error);
    throw new NotFoundError('Process instance not found');
  }
};
