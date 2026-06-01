import { type DbClient, db as defaultDb } from '@op/db/client';
import { resourceCollectionProfiles, resourceCollections } from '@op/db/schema';
import { and, asc, eq, gt } from 'drizzle-orm';

import type { CollectionDTO } from './schemas';

export const DEFAULT_COLLECTION_NAME = 'Default';

export const buildCollectionForProfile = (
  collection: { id: string; name: string },
  link: {
    sortKey: string;
    addedByProfileId: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  },
): CollectionDTO => ({
  id: collection.id,
  name: collection.name,
  sortKey: link.sortKey,
  addedByProfileId: link.addedByProfileId,
  createdAt: link.createdAt,
  updatedAt: link.updatedAt,
});

export const getCollectionsForProfile = ({
  db = defaultDb,
  profileId,
  limit,
  cursor,
}: {
  db?: DbClient;
  profileId: string;
  limit?: number;
  cursor?: string | null;
}): Promise<CollectionDTO[]> => {
  const baseWhere = eq(resourceCollectionProfiles.profileId, profileId);
  const where = cursor
    ? and(baseWhere, gt(resourceCollectionProfiles.sortKey, cursor))
    : baseWhere;
  const builder = db
    .select({
      id: resourceCollections.id,
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
    .where(where)
    .orderBy(asc(resourceCollectionProfiles.sortKey));
  return limit !== undefined ? builder.limit(limit) : builder;
};

export const getCollectionForProfile = async ({
  db = defaultDb,
  profileId,
  collectionId,
}: {
  db?: DbClient;
  profileId: string;
  collectionId: string;
}): Promise<CollectionDTO | null> => {
  const [row] = await db
    .select({
      id: resourceCollections.id,
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
    .where(
      and(
        eq(resourceCollectionProfiles.profileId, profileId),
        eq(resourceCollectionProfiles.collectionId, collectionId),
      ),
    )
    .limit(1);
  return row ?? null;
};
