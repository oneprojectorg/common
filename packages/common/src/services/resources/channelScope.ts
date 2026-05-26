import { db } from '@op/db/client';
import {
  resourceCollectionItems,
  resourceCollectionProfiles,
} from '@op/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Resolve the set of profile IDs that share a collection. Used by the API
 * layer to broadcast realtime invalidations to every profile that subscribes
 * to the collection's list query.
 */
export const getProfileIdsForCollection = async (
  collectionId: string,
): Promise<string[]> => {
  const rows = await db
    .select({ profileId: resourceCollectionProfiles.profileId })
    .from(resourceCollectionProfiles)
    .where(eq(resourceCollectionProfiles.collectionId, collectionId));
  return rows.map((r) => r.profileId);
};

/**
 * Resolve the set of (profileId, collectionId) tuples that a resource belongs
 * to. Used by the API layer to fan invalidations out to every profile/list
 * the resource shows up in.
 */
export const getScopesForResource = async (
  resourceId: string,
): Promise<{ profileIds: string[]; collectionIds: string[] }> => {
  const rows = await db
    .select({
      collectionId: resourceCollectionItems.collectionId,
      profileId: resourceCollectionProfiles.profileId,
    })
    .from(resourceCollectionItems)
    .innerJoin(
      resourceCollectionProfiles,
      eq(
        resourceCollectionProfiles.collectionId,
        resourceCollectionItems.collectionId,
      ),
    )
    .where(eq(resourceCollectionItems.resourceId, resourceId));

  const profileIds = new Set<string>();
  const collectionIds = new Set<string>();
  for (const row of rows) {
    profileIds.add(row.profileId);
    collectionIds.add(row.collectionId);
  }
  return {
    profileIds: [...profileIds],
    collectionIds: [...collectionIds],
  };
};
