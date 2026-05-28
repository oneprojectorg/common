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
  // Try write first so write-capable callers create the Default collection
  // lazily; fall back to read. Profile-ADMIN is already OR-checked inside
  // assertProfileTypeAccess, so the zone check just needs to capture write
  // capability.
  let canWrite = true;
  try {
    await assertProfileTypeAccess({
      user: { id: authUserId },
      profileIds: [profileId],
      policies: {
        [EntityType.DECISION]: { decisions: permission.CREATE },
      },
    });
  } catch {
    canWrite = false;
    await assertProfileTypeAccess({
      user: { id: authUserId },
      profileIds: [profileId],
      policies: {
        [EntityType.DECISION]: { decisions: permission.READ },
      },
    });
  }

  const collection = await resolveOrCreateDefaultCollection({
    profileId,
    createIfMissing: canWrite,
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
