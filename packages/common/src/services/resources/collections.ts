import { db } from '@op/db/client';
import { resourceCollectionProfiles, resourceCollections } from '@op/db/schema';
import { and, asc, count, eq, sql } from 'drizzle-orm';

import { ConflictError, NotFoundError } from '../../utils/error';
import { reorderByUpperNeighbor } from '../../utils/sorting';
import { getCurrentProfileId } from '../access';
import { assertResourceAccess } from './access';
import { applySortOrderUpdates } from './ordering';

const DEFAULT_COLLECTION_NAME = 'Pinned';

export type CollectionForProfile = {
  id: string;
  name: string;
  sortOrder: number;
  addedByProfileUserId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

const profileLock = async ({
  tx,
  profileId,
}: {
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0];
  profileId: string;
}) => {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${'resource_collections:' + profileId}))`,
  );
};

type Executor = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

const collectionsForProfileQuery = ({
  exec,
  profileId,
}: {
  exec: Executor;
  profileId: string;
}): Promise<CollectionForProfile[]> =>
  exec
    .select({
      id: resourceCollections.id,
      name: resourceCollections.name,
      sortOrder: resourceCollectionProfiles.sortOrder,
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
    .orderBy(asc(resourceCollectionProfiles.sortOrder));

const collectionForProfileById = async ({
  exec,
  profileId,
  collectionId,
}: {
  exec: Executor;
  profileId: string;
  collectionId: string;
}): Promise<CollectionForProfile | null> => {
  const [row] = await exec
    .select({
      id: resourceCollections.id,
      name: resourceCollections.name,
      sortOrder: resourceCollectionProfiles.sortOrder,
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
  await assertResourceAccess({ profileId, authUserId, level: 'read' });
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
  await assertResourceAccess({ profileId, authUserId, level: 'write' });

  return db.transaction(async (tx) => {
    await profileLock({ tx, profileId });

    const [maxRow] = await tx
      .select({ value: count() })
      .from(resourceCollectionProfiles)
      .where(eq(resourceCollectionProfiles.profileId, profileId));
    const sortOrder = maxRow?.value ?? 0;

    const [collection] = await tx
      .insert(resourceCollections)
      .values({ name })
      .returning();
    if (!collection) {
      throw new ConflictError('Failed to create collection');
    }

    const [link] = await tx
      .insert(resourceCollectionProfiles)
      .values({ collectionId: collection.id, profileId, sortOrder })
      .returning();
    if (!link) {
      throw new ConflictError('Failed to attach collection to profile');
    }

    return {
      id: collection.id,
      name: collection.name,
      sortOrder: link.sortOrder,
      addedByProfileUserId: link.addedByProfileUserId,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    };
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
  await assertResourceAccess({ profileId, authUserId, level: 'write' });

  const existing = await collectionForProfileById({
    exec: db,
    profileId,
    collectionId: id,
  });
  if (!existing) {
    throw new NotFoundError('Collection', id);
  }

  const patchValues: Partial<{ name: string }> = {};
  if (patch.name !== undefined) {
    patchValues.name = patch.name;
  }

  const [updated] = await db
    .update(resourceCollections)
    .set(patchValues)
    .where(eq(resourceCollections.id, id))
    .returning({ id: resourceCollections.id });

  if (!updated) {
    throw new NotFoundError('Collection', id);
  }

  const row = await collectionForProfileById({
    exec: db,
    profileId,
    collectionId: id,
  });
  if (!row) {
    throw new NotFoundError('Collection', id);
  }
  return row;
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
  await assertResourceAccess({ profileId, authUserId, level: 'write' });

  return db.transaction(async (tx) => {
    await profileLock({ tx, profileId });

    const rows = await tx
      .select({
        id: resourceCollectionProfiles.id,
        collectionId: resourceCollectionProfiles.collectionId,
        sortOrder: resourceCollectionProfiles.sortOrder,
      })
      .from(resourceCollectionProfiles)
      .where(eq(resourceCollectionProfiles.profileId, profileId))
      .orderBy(asc(resourceCollectionProfiles.sortOrder));

    if (!rows.some((r) => r.collectionId === id)) {
      throw new NotFoundError('Collection', id);
    }
    if (
      upperNeighborId !== null &&
      id !== upperNeighborId &&
      !rows.some((r) => r.collectionId === upperNeighborId)
    ) {
      throw new NotFoundError('Pivot collection', upperNeighborId);
    }

    const reordered = reorderByUpperNeighbor({
      list: rows,
      getKey: (r) => r.collectionId,
      movedKey: id,
      upperNeighborKey: upperNeighborId,
    });
    if (reordered !== rows) {
      const updates: Array<{ id: string; sortOrder: number }> = [];
      for (let i = 0; i < reordered.length; i++) {
        const row = reordered[i]!;
        if (row.sortOrder !== i) {
          updates.push({ id: row.id, sortOrder: i });
        }
      }
      await applySortOrderUpdates({
        tx,
        table: resourceCollectionProfiles,
        updates,
      });
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

export const deleteCollection = async ({
  authUserId,
  id,
}: {
  authUserId: string;
  id: string;
}) => {
  const profileId = await getCurrentProfileId(authUserId);
  await assertResourceAccess({ profileId, authUserId, level: 'write' });

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

    // Compact so a later createCollection (count() = next sortOrder) doesn't
    // collide with a leftover gap on the partial unique index.
    const remainingForProfile = await tx
      .select({
        id: resourceCollectionProfiles.id,
        sortOrder: resourceCollectionProfiles.sortOrder,
      })
      .from(resourceCollectionProfiles)
      .where(eq(resourceCollectionProfiles.profileId, profileId))
      .orderBy(asc(resourceCollectionProfiles.sortOrder));
    const compactUpdates: Array<{ id: string; sortOrder: number }> = [];
    remainingForProfile.forEach((row, idx) => {
      if (row.sortOrder !== idx) {
        compactUpdates.push({ id: row.id, sortOrder: idx });
      }
    });
    await applySortOrderUpdates({
      tx,
      table: resourceCollectionProfiles,
      updates: compactUpdates,
    });

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
// a Pinned one (sortOrder=0) when `createIfMissing`.
export const resolveOrCreatePinnedCollection = async ({
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

    const [existing] = await tx
      .select({
        id: resourceCollections.id,
        name: resourceCollections.name,
        sortOrder: resourceCollectionProfiles.sortOrder,
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
      .orderBy(asc(resourceCollectionProfiles.sortOrder))
      .limit(1);
    if (existing) {
      return existing;
    }

    const [collection] = await tx
      .insert(resourceCollections)
      .values({ name: DEFAULT_COLLECTION_NAME })
      .returning();
    if (!collection) {
      throw new ConflictError('Failed to create Pinned collection');
    }

    const [link] = await tx
      .insert(resourceCollectionProfiles)
      .values({ collectionId: collection.id, profileId, sortOrder: 0 })
      .returning();
    if (!link) {
      throw new ConflictError('Failed to attach Pinned collection to profile');
    }

    return {
      id: collection.id,
      name: collection.name,
      sortOrder: link.sortOrder,
      addedByProfileUserId: link.addedByProfileUserId,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    };
  });
};
