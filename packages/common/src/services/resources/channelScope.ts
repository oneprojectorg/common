import { db } from '@op/db/client';
import {
  resourceCollectionItems,
  resourceCollectionProfiles,
} from '@op/db/schema';
import { eq } from 'drizzle-orm';

// Profile IDs sharing a collection — for fanning realtime invalidations.
export const getProfileIdsForCollection = async (
  collectionId: string,
): Promise<string[]> => {
  const rows = await db
    .select({ profileId: resourceCollectionProfiles.profileId })
    .from(resourceCollectionProfiles)
    .where(eq(resourceCollectionProfiles.collectionId, collectionId));
  return rows.map((r) => r.profileId);
};

// (profileId, collectionId) pairs a resource appears in — for fanning
// realtime invalidations.
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
