import { db } from '@op/db/client';
import { EntityType, resourceCollectionProfiles } from '@op/db/schema';
import { permission } from 'access-zones';
import { and, asc, eq, gt, ne } from 'drizzle-orm';
import { generateKeyBetween } from 'fractional-indexing';

import { NotFoundError } from '../../utils/error';
import { lockProfile } from './ordering';
import { assertCollectionAccess } from './resourceAuth';
import type { CollectionDTO } from './schemas';
import { buildCollectionForProfile } from './utils';

export const reorderCollection = async ({
  authUserId,
  id,
  upperNeighborId,
}: {
  authUserId: string;
  id: string;
  upperNeighborId: string | null;
}): Promise<{ collection: CollectionDTO; profileId: string }> => {
  const { parentProfileId: profileId } = await assertCollectionAccess({
    user: { id: authUserId },
    collectionId: id,
    policies: {
      [EntityType.DECISION]: { decisions: permission.ADMIN },
    },
  });

  const collection = await db.transaction(async (tx) => {
    await lockProfile({ tx, profileId });

    const moved = await tx.query.resourceCollectionProfiles.findFirst({
      columns: {
        id: true,
        sortKey: true,
        addedByProfileId: true,
        createdAt: true,
        updatedAt: true,
      },
      where: { profileId, collectionId: id },
      with: { collection: { columns: { name: true } } },
    });
    if (!moved) {
      throw new NotFoundError('Collection', id);
    }

    const toResult = (sortKey: string): CollectionDTO =>
      buildCollectionForProfile(
        { id, name: moved.collection.name },
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
          ne(resourceCollectionProfiles.id, moved.id),
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
      .where(eq(resourceCollectionProfiles.id, moved.id));
    return toResult(newKey);
  });

  return { collection, profileId };
};
