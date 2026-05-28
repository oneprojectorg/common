import { db } from '@op/db/client';
import {
  EntityType,
  resourceCollectionProfiles,
  resourceCollections,
} from '@op/db/schema';
import { permission } from 'access-zones';
import { and, eq, sql } from 'drizzle-orm';

import { NotFoundError } from '../../utils/error';
import { lockProfile } from './ordering';
import { assertCollectionAccess } from './resourceAuth';
import { type CollectionForProfile, collectionForProfileById } from './utils';

export type UpdateCollectionData = {
  name?: string;
};

export const updateCollection = async ({
  authUserId,
  id,
  data,
}: {
  authUserId: string;
  id: string;
  data: UpdateCollectionData;
}): Promise<CollectionForProfile> => {
  const { parentProfileId: profileId } = await assertCollectionAccess({
    user: { id: authUserId },
    collectionId: id,
    policies: {
      [EntityType.DECISION]: { decisions: permission.ADMIN },
    },
  });

  return db.transaction(async (tx) => {
    await lockProfile({ tx, profileId });

    const existing = await collectionForProfileById({
      exec: tx,
      profileId,
      collectionId: id,
    });
    if (!existing) {
      throw new NotFoundError('Collection', id);
    }

    if (data.name !== undefined) {
      const [updated] = await tx
        .update(resourceCollections)
        .set({ name: data.name })
        .where(eq(resourceCollections.id, id))
        .returning({ id: resourceCollections.id });

      if (!updated) {
        throw new NotFoundError('Collection', id);
      }

      // The join row is what the DTO reads updatedAt from — bump it so the
      // response reflects the rename rather than the (stale) attach time.
      await tx
        .update(resourceCollectionProfiles)
        .set({ updatedAt: sql`now()` })
        .where(
          and(
            eq(resourceCollectionProfiles.profileId, profileId),
            eq(resourceCollectionProfiles.collectionId, id),
          ),
        );
    }

    const row = await collectionForProfileById({
      exec: tx,
      profileId,
      collectionId: id,
    });
    if (!row) {
      throw new NotFoundError('Collection', id);
    }
    return row;
  });
};
