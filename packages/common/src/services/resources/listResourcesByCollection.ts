import { EntityType } from '@op/db/schema';
import { permission } from 'access-zones';

import { assertCollectionAccess } from './resourceAuth';
import { getResourcesInCollection } from './resourceQueries';
import { type ResourceListResult } from './types';

export const listResourcesByCollection = async ({
  authUserId,
  collectionId,
  limit,
  cursor,
}: {
  authUserId: string;
  collectionId: string;
  limit?: number;
  cursor?: string | null;
}): Promise<ResourceListResult> => {
  const [result] = await Promise.all([
    getResourcesInCollection({ collectionId, limit, cursor }),
    assertCollectionAccess({
      user: { id: authUserId },
      collectionId,
      policies: {
        [EntityType.DECISION]: { decisions: permission.READ },
      },
    }),
  ]);
  return result;
};
