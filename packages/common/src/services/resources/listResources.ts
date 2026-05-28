import { EntityType } from '@op/db/schema';
import { permission } from 'access-zones';

import { assertProfileTypeAccess } from '../access';
import { resolveOrCreateDefaultCollection } from './resolveOrCreateDefaultCollection';
import { getResourcesInCollection } from './resourceQueries';
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
  // Try write first so admin callers create the Default collection lazily; fall back to read.
  let canWrite = true;
  try {
    await assertProfileTypeAccess({
      user: { id: authUserId },
      profileIds: [profileId],
      policies: {
        [EntityType.DECISION]: { decisions: permission.ADMIN },
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
