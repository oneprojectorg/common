import { cache } from '@op/cache';
import { db } from '@op/db/client';
import {
  attachments,
  objectsInStorage,
  resourceCollectionItems,
  resourceCollectionProfiles,
  resources,
} from '@op/db/schema';
import { permission } from 'access-zones';
import { and, asc, eq } from 'drizzle-orm';

import { type AccessUser } from '../access';
import { assertProfileAccess } from '../assert';
import { type LoadedResource, getResource } from './resourceDTO';
import { type ResourceInCollectionDTO } from './schemas';
import { RESOURCE_LIST_MAX_LIMIT } from './types';

type OrderedResourceRow = {
  collectionId: string;
  sortKey: string;
  resource: LoadedResource;
};

// Short TTL on purpose: @op/cache invalidation is best-effort (the Redis DEL
// runs under a 100ms command timeout and a concurrent reader can repopulate
// the key via the deferred waitUntil write), so a lost invalidation must
// self-heal in minutes, not the 72h default.
const RESOURCE_LIST_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Viewer-independent, display-ordered rows for a profile's flattened resource
 * list. Cached under `['resources', profileId, 'list']` (cf. getInstance's
 * `['decision', id, 'instance']`); mutations bust it via
 * invalidateProfileResources. Signed URLs / link previews are NOT in here —
 * they're resolved per request in getResource against their own short-TTL
 * caches, so a cached list entry can never serve an expired token.
 *
 * skipMemCache: mutations broadcast realtime channels that make clients
 * refetch immediately, and on a multi-instance deploy that refetch can land on
 * an instance whose local LRU was not cleared by the (per-process) invalidate.
 * Reading straight from Redis — which the invalidate does clear — keeps the
 * edit → refetch flow consistent across instances.
 */
const getOrderedResourceRows = (
  profileId: string,
): Promise<OrderedResourceRow[]> =>
  cache({
    type: 'resources',
    params: [profileId, 'list'],
    fetch: async () => {
      // One query, ordered in SQL by (collection-link sortKey, item sortKey) —
      // the sidebar's display order — so the defensive LIMIT truncates the
      // display-order tail rather than an arbitrary cross-collection slice.
      // Item sortKeys are only comparable within a collection, which is why
      // the collection-link key must lead the ORDER BY. A profile with no
      // collections simply joins to zero rows (the Default collection is only
      // created lazily on the first upload).
      const rows = await db
        .select({
          collectionId: resourceCollectionItems.collectionId,
          sortKey: resourceCollectionItems.sortKey,
          resource: resources,
          attachment: attachments,
          storageObjectName: objectsInStorage.name,
        })
        .from(resourceCollectionItems)
        .innerJoin(
          resourceCollectionProfiles,
          and(
            eq(
              resourceCollectionProfiles.collectionId,
              resourceCollectionItems.collectionId,
            ),
            eq(resourceCollectionProfiles.profileId, profileId),
          ),
        )
        .innerJoin(
          resources,
          eq(resources.id, resourceCollectionItems.resourceId),
        )
        .leftJoin(attachments, eq(attachments.id, resources.attachmentId))
        .leftJoin(
          objectsInStorage,
          eq(objectsInStorage.id, attachments.storageObjectId),
        )
        .orderBy(
          asc(resourceCollectionProfiles.sortKey),
          asc(resourceCollectionItems.sortKey),
        )
        .limit(RESOURCE_LIST_MAX_LIMIT);

      return rows.map((row) => ({
        collectionId: row.collectionId,
        sortKey: row.sortKey,
        resource: {
          ...row.resource,
          attachment: row.attachment
            ? {
                storageObjectId: row.attachment.storageObjectId,
                fileName: row.attachment.fileName,
                mimeType: row.attachment.mimeType,
                fileSize: row.attachment.fileSize,
                storageObject: { name: row.storageObjectName },
              }
            : null,
        },
      }));
    },
    options: {
      skipMemCache: true,
      ttl: RESOURCE_LIST_CACHE_TTL_MS,
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
