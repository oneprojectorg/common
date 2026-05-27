import { type DbClient, type TransactionType, db } from '@op/db/client';
import {
  EntityType,
  resourceCollectionProfiles,
  resourceCollections,
} from '@op/db/schema';
import { permission } from 'access-zones';
import { and, asc, count, desc, eq, sql } from 'drizzle-orm';
import { generateKeyBetween } from 'fractional-indexing';

import { ConflictError, NotFoundError } from '../../utils/error';
import { assertProfileTypeAccess, getCurrentProfileId } from '../access';

const DEFAULT_COLLECTION_NAME = 'Default';

export type CollectionForProfile = {
  id: string;
  name: string;
  sortKey: string;
  addedByProfileUserId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

const profileLock = async ({
  tx,
  profileId,
}: {
  tx: TransactionType;
  profileId: string;
}) => {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${'resource_collections:' + profileId}))`,
  );
};

const linkToCollectionForProfile = (
  collection: { id: string; name: string },
  link: {
    sortKey: string;
    addedByProfileUserId: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  },
): CollectionForProfile => ({
  id: collection.id,
  name: collection.name,
  sortKey: link.sortKey,
  addedByProfileUserId: link.addedByProfileUserId,
  createdAt: link.createdAt,
  updatedAt: link.updatedAt,
});

const collectionsForProfileQuery = ({
  exec,
  profileId,
}: {
  exec: DbClient;
  profileId: string;
}): Promise<CollectionForProfile[]> =>
  exec
    .select({
      id: resourceCollections.id,
      name: resourceCollections.name,
      sortKey: resourceCollectionProfiles.sortKey,
      addedByProfileUserId: resourceCollectionProfiles.addedByProfileUserId,
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

const collectionForProfileById = async ({
  exec,
  profileId,
  collectionId,
}: {
  exec: DbClient;
  profileId: string;
  collectionId: string;
}): Promise<CollectionForProfile | null> => {
  const [row] = await exec
    .select({
      id: resourceCollections.id,
      name: resourceCollections.name,
      sortKey: resourceCollectionProfiles.sortKey,
      addedByProfileUserId: resourceCollectionProfiles.addedByProfileUserId,
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
        eq(resourceCollectionProfiles.collectionId, collectionId),
      ),
    )
    .limit(1);
  return row ?? null;
};

export const listCollections = async ({
  authUserId,
  profileId,
}: {
  authUserId: string;
  profileId: string;
}): Promise<CollectionForProfile[]> => {
  await assertProfileTypeAccess({
    user: { id: authUserId },
    profileIds: [profileId],
    policies: {
      [EntityType.DECISION]: { decisions: permission.READ },
    },
  });
  return collectionsForProfileQuery({ exec: db, profileId });
};

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
    await profileLock({ tx, profileId });

    const [tail] = await tx
      .select({ sortKey: resourceCollectionProfiles.sortKey })
      .from(resourceCollectionProfiles)
      .where(eq(resourceCollectionProfiles.profileId, profileId))
      .orderBy(desc(resourceCollectionProfiles.sortKey))
      .limit(1);
    const sortKey = generateKeyBetween(tail?.sortKey ?? null, null);

    const [collection] = await tx
      .insert(resourceCollections)
      .values({ name })
      .returning();
    if (!collection) {
      throw new ConflictError('Failed to create collection');
    }

    const [link] = await tx
      .insert(resourceCollectionProfiles)
      .values({ collectionId: collection.id, profileId, sortKey })
      .returning();
    if (!link) {
      throw new ConflictError('Failed to attach collection to profile');
    }

    return linkToCollectionForProfile(collection, link);
  });
};

export type UpdateCollectionPatch = {
  name?: string;
};

export const updateCollection = async ({
  authUserId,
  id,
  patch,
}: {
  authUserId: string;
  id: string;
  patch: UpdateCollectionPatch;
}): Promise<CollectionForProfile> => {
  const profileId = await getCurrentProfileId(authUserId);
  await assertProfileTypeAccess({
    user: { id: authUserId },
    profileIds: [profileId],
    policies: {
      [EntityType.DECISION]: { decisions: permission.ADMIN },
    },
  });

  return db.transaction(async (tx) => {
    await profileLock({ tx, profileId });

    const existing = await collectionForProfileById({
      exec: tx,
      profileId,
      collectionId: id,
    });
    if (!existing) {
      throw new NotFoundError('Collection', id);
    }

    if (patch.name !== undefined) {
      const [updated] = await tx
        .update(resourceCollections)
        .set({ name: patch.name })
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

export const reorderCollection = async ({
  authUserId,
  id,
  upperNeighborId,
}: {
  authUserId: string;
  id: string;
  upperNeighborId: string | null;
}): Promise<CollectionForProfile> => {
  const profileId = await getCurrentProfileId(authUserId);
  await assertProfileTypeAccess({
    user: { id: authUserId },
    profileIds: [profileId],
    policies: {
      [EntityType.DECISION]: { decisions: permission.ADMIN },
    },
  });

  return db.transaction(async (tx) => {
    await profileLock({ tx, profileId });

    const rows = await tx
      .select({
        rowId: resourceCollectionProfiles.id,
        collectionId: resourceCollectionProfiles.collectionId,
        name: resourceCollections.name,
        sortKey: resourceCollectionProfiles.sortKey,
        addedByProfileUserId: resourceCollectionProfiles.addedByProfileUserId,
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
      addedByProfileUserId: moved.addedByProfileUserId,
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

export const deleteCollection = async ({
  authUserId,
  id,
}: {
  authUserId: string;
  id: string;
}) => {
  const profileId = await getCurrentProfileId(authUserId);
  await assertProfileTypeAccess({
    user: { id: authUserId },
    profileIds: [profileId],
    policies: {
      [EntityType.DECISION]: { decisions: permission.ADMIN },
    },
  });

  const existing = await collectionForProfileById({
    exec: db,
    profileId,
    collectionId: id,
  });
  if (!existing) {
    throw new NotFoundError('Collection', id);
  }

  return db.transaction(async (tx) => {
    await profileLock({ tx, profileId });

    await tx
      .delete(resourceCollectionProfiles)
      .where(
        and(
          eq(resourceCollectionProfiles.collectionId, id),
          eq(resourceCollectionProfiles.profileId, profileId),
        ),
      );

    const [remainingRow] = await tx
      .select({ value: count() })
      .from(resourceCollectionProfiles)
      .where(eq(resourceCollectionProfiles.collectionId, id));
    const remaining = remainingRow?.value ?? 0;

    if (remaining === 0) {
      await tx
        .delete(resourceCollections)
        .where(eq(resourceCollections.id, id));
    }
    return { ok: true as const };
  });
};

// Caller authorizes. Returns the first collection on the profile, or creates
// a Default one when `createIfMissing`.
export const resolveOrCreateDefaultCollection = async ({
  profileId,
  createIfMissing,
}: {
  profileId: string;
  createIfMissing: boolean;
}): Promise<CollectionForProfile | null> => {
  if (!createIfMissing) {
    const rows = await collectionsForProfileQuery({ exec: db, profileId });
    return rows[0] ?? null;
  }

  return db.transaction(async (tx) => {
    await profileLock({ tx, profileId });

    const existing = (await collectionsForProfileQuery({ exec: tx, profileId }))[0];
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

    const [link] = await tx
      .insert(resourceCollectionProfiles)
      .values({
        collectionId: collection.id,
        profileId,
        sortKey: generateKeyBetween(null, null),
      })
      .returning();
    if (!link) {
      throw new ConflictError('Failed to attach Default collection to profile');
    }

    return linkToCollectionForProfile(collection, link);
  });
};
