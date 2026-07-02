import { cache } from '@op/cache';
import { db } from '@op/db/client';
import { permission } from 'access-zones';

import { type AccessUser } from '../access';
import { assertProfileAccess } from '../assert';
import { type LoadedResource, getResource } from './resourceDTO';
import { type ResourceInCollectionDTO } from './schemas';
import { RESOURCE_LIST_MAX_LIMIT } from './types';
import { getCollectionsForProfile } from './utils';

type OrderedResourceRow = {
  collectionId: string;
  sortKey: string;
  resource: LoadedResource;
};

/**
 * Viewer-independent, display-ordered rows for a profile's flattened resource
 * list. Cached under `['resources', profileId, 'list']` (cf. getInstance's
 * `['decision', id, 'instance']`); mutations bust it via
 * invalidateProfileResources. Signed URLs / link previews are NOT in here —
 * they're resolved per request in getResource against their own short-TTL
 * caches, so a long-lived list entry can never serve an expired token.
 */
const getOrderedResourceRows = (
  profileId: string,
): Promise<OrderedResourceRow[]> =>
  cache({
    type: 'resources',
    params: [profileId, 'list'],
    fetch: async () => {
      // Pure read: a profile with no collections just returns an empty list —
      // the Default collection is only created lazily on the first upload.
      const collections = await getCollectionsForProfile({ profileId });
      if (collections.length === 0) {
        return [];
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

      // Interleave the two DB orders: collections are sortKey-ordered above
      // and rows are item-sortKey-ordered, so a stable sort by collection
      // position yields (collection sortKey, item sortKey). Safe in JS because
      // the result is never paginated — there is no cursor for a partial order
      // to break.
      const collectionPosition = new Map(
        collections.map((collection, index) => [collection.id, index]),
      );
      return [...rows].sort(
        (a, b) =>
          (collectionPosition.get(a.collectionId) ?? 0) -
          (collectionPosition.get(b.collectionId) ?? 0),
      );
    },
  });

/**
 * Flattened list of every resource across a profile's collections, ordered by
 * (collection sortKey, item sortKey) — the display order of the decision
 * overview's "Pinned Resources" sidebar. One collections read + one items read
 * replaces the per-collection fan-out (1 + N queries) the overview used to do,
 * and the combined result is cached (see getOrderedResourceRows), so a warm
 * read costs no resource-table queries at all.
 *
 * The access check + per-item hydration run on every call, outside the cache:
 * a hit can never bypass authorization or serve an expired signed URL.
 *
 * Not paginated: pinned resources are a curated sidebar list. The items read
 * is capped at RESOURCE_LIST_MAX_LIMIT as a defensive bound on this open
 * endpoint.
 */
export const listResources = async ({
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

  const ordered = await getOrderedResourceRows(profileId);

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
