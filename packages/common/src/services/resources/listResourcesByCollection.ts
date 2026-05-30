import { EntityType } from '@op/db/schema';
import { permission } from 'access-zones';

import { getResourcesInCollection } from './getResourcesInCollection';
import { assertCollectionAccess } from './resourceAuth';
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
  // Authorize before fetching: the read fans out into per-item signed-URL
  // generation, so an unauthorized caller must not be able to trigger that
  // work (DB reads + Supabase sign calls) before being rejected.
  await assertCollectionAccess({
    user: { id: authUserId },
    collectionId,
    policies: {
      [EntityType.DECISION]: { decisions: permission.READ },
    },
  });

  return getResourcesInCollection({ collectionId, limit, cursor });
};
