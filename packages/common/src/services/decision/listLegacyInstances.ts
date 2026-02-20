import { db, desc, eq } from '@op/db/client';
import { organizations, processInstances } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import { getOrgAccessUser } from '../access';

export const listLegacyInstances = async ({
  ownerProfileId,
  user,
}: {
  ownerProfileId: string;
  user: User;
}) => {
  const org = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.profileId, ownerProfileId));

  if (!org[0]?.id) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  const orgUser = await getOrgAccessUser({
    user,
    organizationId: org[0].id,
  });

  assertAccess({ decisions: permission.READ }, orgUser?.roles ?? []);

  const instanceList = await db._query.processInstances.findMany({
    where: eq(processInstances.ownerProfileId, ownerProfileId),
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
    orderBy: desc(processInstances.createdAt),
  });

  return instanceList.map((instance) => {
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
  });
};
