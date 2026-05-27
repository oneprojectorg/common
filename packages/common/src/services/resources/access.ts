import { EntityType } from '@op/db/schema';
import { permission } from 'access-zones';

import { assertProfileTypeAccess } from '../access';

export type ResourceAccessLevel = 'read' | 'write';

export const assertResourceAccess = async ({
  profileId,
  authUserId,
  level,
}: {
  profileId: string;
  authUserId: string;
  level: ResourceAccessLevel;
}): Promise<void> => {
  await assertProfileTypeAccess({
    user: { id: authUserId },
    profileIds: [profileId],
    policies: {
      [EntityType.DECISION]:
        level === 'write'
          ? { decisions: permission.ADMIN }
          : { decisions: permission.READ },
    },
  });
};
