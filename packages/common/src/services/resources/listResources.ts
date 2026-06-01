import { EntityType } from '@op/db/schema';
import { permission } from 'access-zones';

import { assertProfileTypeAccess } from '../access';
import { getResourcesInCollection } from './getResourcesInCollection';
import { resolveOrCreateDefaultCollection } from './resolveOrCreateDefaultCollection';
import { type ResourceListResult } from './types';

export const listResources = async ({
  authUserId,
  profileId,
  limit,
  cursor,
}: {
  authUserId: string;
  profileId: string;
  limit?: number;
  cursor?: string | null;
}): Promise<ResourceListResult> => {
  await assertProfileTypeAccess({
    user: { id: authUserId },
    profileIds: [profileId],
    policies: {
      [EntityType.DECISION]: { decisions: permission.READ },
    },
  });

  // Listing never creates. The Default collection is created lazily on the
  // first upload (createLink/createDocument -> resolveTargetCollection); until
  // then a profile simply has no collection and we return an empty list.
  const collection = await resolveOrCreateDefaultCollection({
    profileId,
    createIfMissing: false,
  });
  if (!collection) {
    return { collectionId: null, items: [], next: null };
  }

  return getResourcesInCollection({
    collectionId: collection.id,
    limit,
    cursor,
  });
};
