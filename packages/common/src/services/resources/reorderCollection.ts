import { db } from '@op/db/client';
import {
  EntityType,
  resourceCollectionProfiles,
  resourceCollections,
} from '@op/db/schema';
import { permission } from 'access-zones';
import { and, asc, eq, gt, ne } from 'drizzle-orm';
import { generateKeyBetween } from 'fractional-indexing';

import { NotFoundError } from '../../utils/error';
import { lockProfile } from './ordering';
import { assertCollectionAccess } from './resourceAuth';
import { type CollectionForProfile, buildCollectionForProfile } from './utils';

export const reorderCollection = async ({
  authUserId,
  id,
  upperNeighborId,
}: {
  authUserId: string;
  id: string;
  upperNeighborId: string | null;
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

    const [moved] = await tx
      .select({
        rowId: resourceCollectionProfiles.id,
        sortKey: resourceCollectionProfiles.sortKey,
        name: resourceCollections.name,
        addedByProfileId: resourceCollectionProfiles.addedByProfileId,
        createdAt: resourceCollectionProfiles.createdAt,
        updatedAt: resourceCollectionProfiles.updatedAt,
      })
      .from(resourceCollectionProfiles)
      .innerJoin(
        resourceCollections,
        eq(resourceCollections.id, resourceCollectionProfiles.collectionId),
      )
      .where(
        and(
          eq(resourceCollectionProfiles.profileId, profileId),
          eq(resourceCollectionProfiles.collectionId, id),
        ),
      )
      .limit(1);
    if (!moved) {
      throw new NotFoundError('Collection', id);
    }

    const toResult = (sortKey: string): CollectionForProfile =>
      buildCollectionForProfile(
        { id, name: moved.name },
        {
          sortKey,
          addedByProfileId: moved.addedByProfileId,
          createdAt: moved.createdAt,
          updatedAt: moved.updatedAt,
        },
      );

    if (id === upperNeighborId) {
      return toResult(moved.sortKey);
    }

    let upperKey: string | null = null;
    if (upperNeighborId !== null) {
      const [upper] = await tx
        .select({ sortKey: resourceCollectionProfiles.sortKey })
        .from(resourceCollectionProfiles)
        .where(
          and(
            eq(resourceCollectionProfiles.profileId, profileId),
            eq(resourceCollectionProfiles.collectionId, upperNeighborId),
          ),
        )
        .limit(1);
      if (!upper) {
        throw new NotFoundError('Pivot collection', upperNeighborId);
      }
      upperKey = upper.sortKey;
    }

    const [lower] = await tx
      .select({ sortKey: resourceCollectionProfiles.sortKey })
      .from(resourceCollectionProfiles)
      .where(
        and(
          eq(resourceCollectionProfiles.profileId, profileId),
          ne(resourceCollectionProfiles.id, moved.rowId),
          upperKey !== null
            ? gt(resourceCollectionProfiles.sortKey, upperKey)
            : undefined,
        ),
      )
      .orderBy(asc(resourceCollectionProfiles.sortKey))
      .limit(1);

    const alreadyInSlot =
      (upperKey === null || moved.sortKey > upperKey) &&
      (!lower || lower.sortKey > moved.sortKey);
    if (alreadyInSlot) {
      return toResult(moved.sortKey);
    }

    const newKey = generateKeyBetween(upperKey, lower?.sortKey ?? null);
    await tx
      .update(resourceCollectionProfiles)
      .set({ sortKey: newKey })
      .where(eq(resourceCollectionProfiles.id, moved.rowId));
    return toResult(newKey);
  });
};
