import type { DbClient, TransactionType } from '@op/db/client';
import {
  type ResourceCollectionItem,
  resourceCollectionItems,
  resourceCollectionProfiles,
} from '@op/db/schema';
import { and, asc, eq, gt, ne, sql } from 'drizzle-orm';
import { generateKeyBetween } from 'fractional-indexing';

import { ConflictError, NotFoundError } from '../../utils/error';

// Serializes concurrent ordering writes on one collection for the transaction.
// With fractional keys the critical section is only the read-neighbors →
// write-row window, but two concurrent inserts at the same slot would still
// compute the same midpoint and trip the unique index, so we keep the lock.
export const lockCollection = async ({
  tx,
  collectionId,
}: {
  tx: TransactionType;
  collectionId: string;
}): Promise<void> => {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${'resources:' + collectionId}))`,
  );
};

// Caller holds lockCollection. Returns the sortKey to assign to a new row
// being inserted at the top of `collectionId` (above all existing rows).
export const generateKeyForInsertAtTop = async ({
  tx,
  collectionId,
}: {
  tx: TransactionType;
  collectionId: string;
}): Promise<string> => {
  const [head] = await tx
    .select({ sortKey: resourceCollectionItems.sortKey })
    .from(resourceCollectionItems)
    .where(eq(resourceCollectionItems.collectionId, collectionId))
    .orderBy(asc(resourceCollectionItems.sortKey))
    .limit(1);
  return generateKeyBetween(null, head?.sortKey ?? null);
};

// Caller holds lockCollection. Looks up the moved row, upperNeighbor, and the
// first row above the requested slot via indexed queries (no full-list scan),
// then computes the new sortKey via generateKeyBetween. Null upperNeighborId
// means "move to top". `changed: false` means the row already sits in the
// requested slot — sortKey is the current value, and the caller should skip
// the UPDATE.
export const computeReorder = async ({
  tx,
  collectionId,
  itemId,
  upperNeighborId,
}: {
  tx: TransactionType;
  collectionId: string;
  itemId: string;
  upperNeighborId: string | null;
}): Promise<{ rowId: string; sortKey: string; changed: boolean }> => {
  const [moved] = await tx
    .select({
      id: resourceCollectionItems.id,
      sortKey: resourceCollectionItems.sortKey,
    })
    .from(resourceCollectionItems)
    .where(
      and(
        eq(resourceCollectionItems.collectionId, collectionId),
        eq(resourceCollectionItems.resourceId, itemId),
      ),
    )
    .limit(1);
  if (!moved) {
    throw new NotFoundError('Resource membership', itemId);
  }

  if (itemId === upperNeighborId) {
    return { rowId: moved.id, sortKey: moved.sortKey, changed: false };
  }

  let upperKey: string | null = null;
  if (upperNeighborId !== null) {
    const [upper] = await tx
      .select({ sortKey: resourceCollectionItems.sortKey })
      .from(resourceCollectionItems)
      .where(
        and(
          eq(resourceCollectionItems.collectionId, collectionId),
          eq(resourceCollectionItems.resourceId, upperNeighborId),
        ),
      )
      .limit(1);
    if (!upper) {
      throw new NotFoundError('Pivot resource', upperNeighborId);
    }
    upperKey = upper.sortKey;
  }

  // The row that should end up just below the moved row's new slot: the
  // smallest sortKey greater than upperKey (or the smallest overall when
  // moving to the top), excluding the moved row itself.
  const [lower] = await tx
    .select({ sortKey: resourceCollectionItems.sortKey })
    .from(resourceCollectionItems)
    .where(
      and(
        eq(resourceCollectionItems.collectionId, collectionId),
        ne(resourceCollectionItems.id, moved.id),
        upperKey !== null
          ? gt(resourceCollectionItems.sortKey, upperKey)
          : undefined,
      ),
    )
    .orderBy(asc(resourceCollectionItems.sortKey))
    .limit(1);

  // Already in slot? moved sits strictly above upperKey (or upperKey is null
  // and we're moving to the top) and strictly below the nearest non-moved row
  // above it — moved.sortKey is in the open interval (upperKey, lower.sortKey).
  const alreadyInSlot =
    (upperKey === null || moved.sortKey > upperKey) &&
    (!lower || lower.sortKey > moved.sortKey);
  if (alreadyInSlot) {
    return { rowId: moved.id, sortKey: moved.sortKey, changed: false };
  }

  return {
    rowId: moved.id,
    sortKey: generateKeyBetween(upperKey, lower?.sortKey ?? null),
    changed: true,
  };
};

export const insertResourceAtTop = async ({
  tx,
  collectionId,
  resourceId,
  addedByProfileId,
}: {
  tx: TransactionType;
  collectionId: string;
  resourceId: string;
  addedByProfileId: string | null;
}): Promise<ResourceCollectionItem> => {
  await lockCollection({ tx, collectionId });
  const sortKey = await generateKeyForInsertAtTop({ tx, collectionId });
  const [resourceItem] = await tx
    .insert(resourceCollectionItems)
    .values({
      collectionId,
      resourceId,
      sortKey,
      addedByProfileId,
    })
    .returning();
  if (!resourceItem) {
    throw new ConflictError('Failed to attach resource to collection');
  }
  return resourceItem;
};

export const findCollectionItem = async ({
  tx,
  collectionId,
  resourceId,
}: {
  tx: DbClient;
  collectionId: string;
  resourceId: string;
}) => {
  const row = await tx.query.resourceCollectionItems.findFirst({
    where: {
      collectionId,
      resourceId,
    },
  });
  return row ?? null;
};

// Serializes concurrent ordering writes on the collection list for one profile.
export const lockProfile = async ({
  tx,
  profileId,
}: {
  tx: TransactionType;
  profileId: string;
}): Promise<void> => {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${'resource_collections:' + profileId}))`,
  );
};

// Caller holds lockProfile. Inserts a profile→collection junction row at the
// bottom of the profile's list and returns it.
export const appendCollectionToProfile = async ({
  tx,
  profileId,
  collectionId,
}: {
  tx: TransactionType;
  profileId: string;
  collectionId: string;
}) => {
  const tail = await tx.query.resourceCollectionProfiles.findFirst({
    columns: { sortKey: true },
    where: { profileId },
    orderBy: { sortKey: 'desc' },
  });
  const sortKey = generateKeyBetween(tail?.sortKey ?? null, null);

  const [collectionProfile] = await tx
    .insert(resourceCollectionProfiles)
    .values({ collectionId, profileId, sortKey })
    .returning();
  if (!collectionProfile) {
    throw new ConflictError('Failed to attach collection to profile');
  }
  return collectionProfile;
};
