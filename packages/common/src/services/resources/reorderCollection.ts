import { db } from '@op/db/client';
import {
  EntityType,
  resourceCollectionProfiles,
  resourceCollections,
} from '@op/db/schema';
import { permission } from 'access-zones';
import { asc, eq } from 'drizzle-orm';
import { generateKeyBetween } from 'fractional-indexing';

import { NotFoundError } from '../../utils/error';
import { lockProfile } from './ordering';
import { assertCollectionAccess } from './resourceAuth';
import { type CollectionForProfile } from './utils';

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

    const rows = await tx
      .select({
        rowId: resourceCollectionProfiles.id,
        collectionId: resourceCollectionProfiles.collectionId,
        name: resourceCollections.name,
        sortKey: resourceCollectionProfiles.sortKey,
        addedByProfileId: resourceCollectionProfiles.addedByProfileId,
        createdAt: resourceCollectionProfiles.createdAt,
        updatedAt: resourceCollectionProfiles.updatedAt,
      })
      .from(resourceCollectionProfiles)
      .innerJoin(
        resourceCollections,
        eq(resourceCollections.id, resourceCollectionProfiles.collectionId),
      )
      .where(eq(resourceCollectionProfiles.profileId, profileId))
      .orderBy(asc(resourceCollectionProfiles.sortKey));

    const movedIdx = rows.findIndex((r) => r.collectionId === id);
    if (movedIdx === -1) {
      throw new NotFoundError('Collection', id);
    }
    const moved = rows[movedIdx]!;
    const toDTO = (sortKey: string): CollectionForProfile => ({
      id: moved.collectionId,
      name: moved.name,
      sortKey,
      addedByProfileId: moved.addedByProfileId,
      createdAt: moved.createdAt,
      updatedAt: moved.updatedAt,
    });

    if (id === upperNeighborId) {
      return toDTO(moved.sortKey);
    }

    let upperIdx: number;
    if (upperNeighborId === null) {
      upperIdx = -1;
    } else {
      upperIdx = rows.findIndex((r) => r.collectionId === upperNeighborId);
      if (upperIdx === -1) {
        throw new NotFoundError('Pivot collection', upperNeighborId);
      }
    }

    const expectedIdxAfterRemoval =
      upperIdx === -1 ? 0 : upperIdx < movedIdx ? upperIdx + 1 : upperIdx;
    if (expectedIdxAfterRemoval === movedIdx) {
      return toDTO(moved.sortKey);
    }

    const upperKey = upperIdx === -1 ? null : rows[upperIdx]!.sortKey;
    const lowerCandidateIdx = upperIdx + 1;
    const lowerKey =
      lowerCandidateIdx === movedIdx
        ? (rows[lowerCandidateIdx + 1]?.sortKey ?? null)
        : (rows[lowerCandidateIdx]?.sortKey ?? null);
    const newKey = generateKeyBetween(upperKey, lowerKey);
    await tx
      .update(resourceCollectionProfiles)
      .set({ sortKey: newKey })
      .where(eq(resourceCollectionProfiles.id, moved.rowId));
    return toDTO(newKey);
  });
};
