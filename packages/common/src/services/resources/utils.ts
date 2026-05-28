import { type DbClient } from '@op/db/client';
import { resourceCollectionProfiles, resourceCollections } from '@op/db/schema';
import { and, asc, eq, gt } from 'drizzle-orm';

export const DEFAULT_COLLECTION_NAME = 'Default';

export type CollectionForProfile = {
  id: string;
  name: string;
  sortKey: string;
  addedByProfileId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export const linkToCollectionForProfile = (
  collection: { id: string; name: string },
  link: {
    sortKey: string;
    addedByProfileId: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  },
): CollectionForProfile => ({
  id: collection.id,
  name: collection.name,
  sortKey: link.sortKey,
  addedByProfileId: link.addedByProfileId,
  createdAt: link.createdAt,
  updatedAt: link.updatedAt,
});

export const collectionsForProfileQuery = ({
  exec,
  profileId,
  limit,
  cursor,
}: {
  exec: DbClient;
  profileId: string;
  limit?: number;
  cursor?: string | null;
}): Promise<CollectionForProfile[]> => {
  const baseWhere = eq(resourceCollectionProfiles.profileId, profileId);
  const where = cursor
    ? and(baseWhere, gt(resourceCollectionProfiles.sortKey, cursor))
    : baseWhere;
  const builder = exec
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

export const collectionForProfileById = async ({
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
