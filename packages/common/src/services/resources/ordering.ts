import type { DbClient, TransactionType } from '@op/db/client';
import {
  resourceCollectionItems,
  resourceCollectionProfiles,
} from '@op/db/schema';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
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

// Caller holds lockCollection. Reads the moved item + upperNeighbor + the row
// immediately after upperNeighbor, computes one new sortKey via
// generateKeyBetween, and returns it. Null upperNeighborId means "move to top".
// `changed: false` means the row is already in the requested slot — sortKey is
// the current value, and the caller should skip the UPDATE.
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
  const rows = await tx
    .select({
      id: resourceCollectionItems.id,
      resourceId: resourceCollectionItems.resourceId,
      sortKey: resourceCollectionItems.sortKey,
    })
    .from(resourceCollectionItems)
    .where(eq(resourceCollectionItems.collectionId, collectionId))
    .orderBy(asc(resourceCollectionItems.sortKey));

  const movedIdx = rows.findIndex((r) => r.resourceId === itemId);
  if (movedIdx === -1) {
    throw new NotFoundError('Resource membership', itemId);
  }
  const moved = rows[movedIdx]!;

  if (itemId === upperNeighborId) {
    return { rowId: moved.id, sortKey: moved.sortKey, changed: false };
  }

  let upperIdx: number;
  if (upperNeighborId === null) {
    upperIdx = -1;
  } else {
    upperIdx = rows.findIndex((r) => r.resourceId === upperNeighborId);
    if (upperIdx === -1) {
      throw new NotFoundError('Pivot resource', upperNeighborId);
    }
  }

  // Already sits in the requested slot? (sandwiched between upper and the row
  // that follows upper in the current ordering, ignoring the moved row itself.)
  const expectedIdxAfterRemoval =
    upperIdx === -1 ? 0 : upperIdx < movedIdx ? upperIdx + 1 : upperIdx;
  if (expectedIdxAfterRemoval === movedIdx) {
    return { rowId: moved.id, sortKey: moved.sortKey, changed: false };
  }

  const upperKey = upperIdx === -1 ? null : rows[upperIdx]!.sortKey;
  // The row that should end up below the moved row is the one currently at
  // (upperIdx + 1), unless that's the moved row itself (then skip it).
  const lowerCandidateIdx = upperIdx + 1;
  const lowerKey =
    lowerCandidateIdx === movedIdx
      ? (rows[lowerCandidateIdx + 1]?.sortKey ?? null)
      : (rows[lowerCandidateIdx]?.sortKey ?? null);

  return {
    rowId: moved.id,
    sortKey: generateKeyBetween(upperKey, lowerKey),
    changed: true,
  };
};

export const insertAtTop = async ({
  tx,
  collectionId,
  resourceId,
  addedByProfileId,
}: {
  tx: TransactionType;
  collectionId: string;
  resourceId: string;
  addedByProfileId: string | null;
}): Promise<string> => {
  await lockCollection({ tx, collectionId });
  const sortKey = await generateKeyForInsertAtTop({ tx, collectionId });
  const [link] = await tx
    .insert(resourceCollectionItems)
    .values({
      collectionId,
      resourceId,
      sortKey,
      addedByProfileId,
    })
    .returning();
  if (!link) {
    throw new ConflictError('Failed to attach resource to collection');
  }
  return sortKey;
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
  const [row] = await tx
    .select()
    .from(resourceCollectionItems)
    .where(
      and(
        eq(resourceCollectionItems.collectionId, collectionId),
        eq(resourceCollectionItems.resourceId, resourceId),
      ),
    )
    .limit(1);
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
  const [tail] = await tx
    .select({ sortKey: resourceCollectionProfiles.sortKey })
    .from(resourceCollectionProfiles)
    .where(eq(resourceCollectionProfiles.profileId, profileId))
    .orderBy(desc(resourceCollectionProfiles.sortKey))
    .limit(1);
  const sortKey = generateKeyBetween(tail?.sortKey ?? null, null);

  const [link] = await tx
    .insert(resourceCollectionProfiles)
    .values({ collectionId, profileId, sortKey })
    .returning();
  if (!link) {
    throw new ConflictError('Failed to attach collection to profile');
  }
  return link;
};
