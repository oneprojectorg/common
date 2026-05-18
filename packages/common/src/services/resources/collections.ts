import { db } from '@op/db/client';
import { resourceCollectionProfiles, resourceCollections } from '@op/db/schema';
import { and, asc, count, eq, sql } from 'drizzle-orm';

import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../utils/error';
import { assertResourceAccess } from './access';

const DEFAULT_COLLECTION_NAME = 'Pinned';

export type CollectionForProfile = {
  id: string;
  name: string;
  sortOrder: number;
  addedByProfileUserId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

const profileLock = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  profileId: string,
) => {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${'resource_collections:' + profileId}))`,
  );
};

const collectionsForProfileQuery = (
  exec: typeof db,
  profileId: string,
): Promise<CollectionForProfile[]> =>
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

export const listCollections = async (
  authUserId: string,
  profileId: string,
): Promise<CollectionForProfile[]> => {
  await assertResourceAccess(
    { kind: 'profile', profileId },
    authUserId,
    'read',
  );
  return collectionsForProfileQuery(db, profileId);
};

export const createCollection = async (
  authUserId: string,
  profileId: string,
  name: string,
): Promise<CollectionForProfile> => {
  await assertResourceAccess(
    { kind: 'profile', profileId },
    authUserId,
    'write',
  );

  return db.transaction(async (tx) => {
    await profileLock(tx, profileId);

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

export const renameCollection = async (
  authUserId: string,
  id: string,
  name: string,
) => {
  await assertResourceAccess(
    { kind: 'collection', collectionId: id },
    authUserId,
    'write',
  );

  const [row] = await db
    .update(resourceCollections)
    .set({ name })
    .where(eq(resourceCollections.id, id))
    .returning();

  if (!row) {
    throw new NotFoundError('Collection', id);
  }
  return row;
};

export const reorderCollection = async (
  authUserId: string,
  id: string,
  beforeId: string | undefined,
  afterId: string | undefined,
) => {
  if ((beforeId === undefined) === (afterId === undefined)) {
    throw new ValidationError('Exactly one of beforeId / afterId is required');
  }

  const resolved = await assertResourceAccess(
    { kind: 'collection', collectionId: id },
    authUserId,
    'write',
  );

  return db.transaction(async (tx) => {
    await profileLock(tx, resolved.profileId);

    const rows = await tx
      .select({
        id: resourceCollectionProfiles.id,
        collectionId: resourceCollectionProfiles.collectionId,
        sortOrder: resourceCollectionProfiles.sortOrder,
      })
      .from(resourceCollectionProfiles)
      .where(eq(resourceCollectionProfiles.profileId, resolved.profileId))
      .orderBy(asc(resourceCollectionProfiles.sortOrder));

    const fromIdx = rows.findIndex((r) => r.collectionId === id);
    if (fromIdx === -1) {
      throw new NotFoundError('Collection', id);
    }
    const moved = rows[fromIdx]!;
    const without = rows.filter((_, i) => i !== fromIdx);

    let toIdx: number;
    if (beforeId !== undefined) {
      toIdx = without.findIndex((r) => r.collectionId === beforeId);
      if (toIdx === -1) {
        throw new NotFoundError('Pivot collection', beforeId);
      }
    } else {
      const afterIdx = without.findIndex((r) => r.collectionId === afterId);
      if (afterIdx === -1) {
        throw new NotFoundError('Pivot collection', afterId as string);
      }
      toIdx = afterIdx + 1;
    }

    const reordered = [
      ...without.slice(0, toIdx),
      moved,
      ...without.slice(toIdx),
    ];

    for (let i = 0; i < reordered.length; i++) {
      const row = reordered[i]!;
      if (row.sortOrder !== i) {
        await tx
          .update(resourceCollectionProfiles)
          .set({ sortOrder: i })
          .where(eq(resourceCollectionProfiles.id, row.id));
      }
    }

    const [row] = await tx
      .select({
        id: resourceCollections.id,
        name: resourceCollections.name,
        sortOrder: resourceCollectionProfiles.sortOrder,
      })
      .from(resourceCollectionProfiles)
      .innerJoin(
        resourceCollections,
        eq(resourceCollections.id, resourceCollectionProfiles.collectionId),
      )
      .where(eq(resourceCollectionProfiles.id, moved.id))
      .limit(1);

    if (!row) {
      throw new NotFoundError('Collection', id);
    }
    return row;
  });
};

export const deleteCollection = async (authUserId: string, id: string) => {
  const resolved = await assertResourceAccess(
    { kind: 'collection', collectionId: id },
    authUserId,
    'write',
  );

  return db.transaction(async (tx) => {
    await tx
      .delete(resourceCollectionProfiles)
      .where(
        and(
          eq(resourceCollectionProfiles.collectionId, id),
          eq(resourceCollectionProfiles.profileId, resolved.profileId),
        ),
      );

    const [{ value: remaining = 0 } = { value: 0 }] = await tx
      .select({ value: count() })
      .from(resourceCollectionProfiles)
      .where(eq(resourceCollectionProfiles.collectionId, id));

    if (remaining === 0) {
      await tx
        .delete(resourceCollections)
        .where(eq(resourceCollections.id, id));
    }
    return { ok: true as const };
  });
};

// Authorization is the caller's responsibility — invoked from both reader (no
// create) and writer (create) paths. Returns the first collection attached to
// the profile; creates a Pinned collection (sortOrder=0) if none exists.
export const resolveOrCreatePinnedCollection = async (
  profileId: string,
  createIfMissing: boolean,
): Promise<CollectionForProfile | null> => {
  if (!createIfMissing) {
    const rows = await collectionsForProfileQuery(db, profileId);
    return rows[0] ?? null;
  }

  return db.transaction(async (tx) => {
    await profileLock(tx, profileId);

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
