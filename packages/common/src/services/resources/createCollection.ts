import { db } from '@op/db/client';
import { EntityType, resourceCollections } from '@op/db/schema';
import { permission } from 'access-zones';

import { ConflictError } from '../../utils/error';
import { assertProfileTypeAccess } from '../access';
import { appendCollectionToProfile, lockProfile } from './ordering';
import { type CollectionForProfile, buildCollectionForProfile } from './utils';

export const createCollection = async ({
  authUserId,
  profileId,
  name,
}: {
  authUserId: string;
  profileId: string;
  name: string;
}): Promise<CollectionForProfile> => {
  await assertProfileTypeAccess({
    user: { id: authUserId },
    profileIds: [profileId],
    policies: {
      [EntityType.DECISION]: { decisions: permission.ADMIN },
    },
  });

  return db.transaction(async (tx) => {
    await lockProfile({ tx, profileId });

    const [collection] = await tx
      .insert(resourceCollections)
      .values({ name })
      .returning();
    if (!collection) {
      throw new ConflictError('Failed to create collection');
    }

    const link = await appendCollectionToProfile({
      tx,
      profileId,
      collectionId: collection.id,
    });

    return buildCollectionForProfile(collection, link);
  });
};
