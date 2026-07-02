import { db } from '@op/db/client';
import { permission } from 'access-zones';

import { type AccessUser } from '../access';
import { assertProfileAccess } from '../assert';
import { getResource } from './resourceDTO';
import { type ResourceInCollectionDTO } from './schemas';
import { RESOURCE_LIST_MAX_LIMIT } from './types';
import { getCollectionsForProfile } from './utils';

/**
 * Flattened list of every resource across a profile's collections, ordered by
 * (collection sortKey, item sortKey) — the display order of the decision
 * overview's "Pinned Resources" sidebar. One collections read + one items read
 * replaces the per-collection fan-out (1 + N queries) the overview used to do.
 *
 * Not paginated: pinned resources are a curated sidebar list. The items read
 * is capped at RESOURCE_LIST_MAX_LIMIT as a defensive bound on this open
 * endpoint.
 */
export const listResourcesAcrossCollections = async ({
  user,
  profileId,
}: {
  user?: AccessUser;
  profileId: string;
}): Promise<{ items: ResourceInCollectionDTO[] }> => {
  // Same fail-closed gate as listCollections: this endpoint is public, so
  // require a decisions READ grant (own or public). One check on the parent
  // profile covers every collection it links.
  await assertProfileAccess({
    user,
    profileId,
    permissions: { decisions: permission.READ },
  });

  const collections = await getCollectionsForProfile({ profileId });
  if (collections.length === 0) {
    return { items: [] };
  }

  const rows = await db.query.resourceCollectionItems.findMany({
    where: { collectionId: { in: collections.map((c) => c.id) } },
    orderBy: { sortKey: 'asc' },
    limit: RESOURCE_LIST_MAX_LIMIT,
    with: {
      resource: {
        with: { attachment: { with: { storageObject: true } } },
      },
    },
  });

  // Interleave the two DB orders: collections are sortKey-ordered above and
  // rows are item-sortKey-ordered, so a stable sort by collection position
  // yields (collection sortKey, item sortKey). Safe in JS because the result
  // is never paginated — there is no cursor for a partial order to break.
  const collectionPosition = new Map(
    collections.map((collection, index) => [collection.id, index]),
  );
  const ordered = [...rows].sort(
    (a, b) =>
      (collectionPosition.get(a.collectionId) ?? 0) -
      (collectionPosition.get(b.collectionId) ?? 0),
  );

  const items = await Promise.all(
    ordered.map(async (item) => {
      const base = await getResource(item.resource);
      return {
        ...base,
        collectionId: item.collectionId,
        sortKey: item.sortKey,
      };
    }),
  );

  return { items };
};
