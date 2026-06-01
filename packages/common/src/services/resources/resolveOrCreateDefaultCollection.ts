import { db } from '@op/db/client';
import { resourceCollections } from '@op/db/schema';

import { ConflictError } from '../../utils/error';
import { appendCollectionToProfile, lockProfile } from './ordering';
import { type CollectionDTO } from './schemas';
import {
  DEFAULT_COLLECTION_NAME,
  buildCollectionForProfile,
  getCollectionsForProfile,
} from './utils';

// Caller authorizes. Returns the first collection on the profile, or creates
// a Default one when `createIfMissing`.
export const resolveOrCreateDefaultCollection = async ({
  profileId,
  createIfMissing,
}: {
  profileId: string;
  createIfMissing: boolean;
}): Promise<CollectionDTO | null> => {
  if (!createIfMissing) {
    const [row] = await getCollectionsForProfile({ profileId, limit: 1 });
    return row ?? null;
  }

  return db.transaction(async (tx) => {
    await lockProfile({ tx, profileId });

    const [existing] = await getCollectionsForProfile({
      db: tx,
      profileId,
      limit: 1,
    });
    if (existing) {
      return existing;
    }

    const [collection] = await tx
      .insert(resourceCollections)
      .values({ name: DEFAULT_COLLECTION_NAME })
      .returning();
    if (!collection) {
      throw new ConflictError('Failed to create Default collection');
    }

    const link = await appendCollectionToProfile({
      tx,
      profileId,
      collectionId: collection.id,
    });

    return buildCollectionForProfile(collection, link);
  });
};
