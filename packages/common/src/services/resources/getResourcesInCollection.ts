import { type DbClient, db as defaultDb } from '@op/db/client';

import { decodeCursor, encodeCursor } from '../../utils';
import { getResource } from './resourceDTO';
import {
  RESOURCE_LIST_DEFAULT_LIMIT,
  RESOURCE_LIST_MAX_LIMIT,
  type ResourceListResult,
} from './types';

type SortKeyCursor = { value: string };

export const getResourcesInCollection = async ({
  db = defaultDb,
  collectionId,
  limit = RESOURCE_LIST_DEFAULT_LIMIT,
  cursor,
}: {
  db?: DbClient;
  collectionId: string;
  limit?: number;
  cursor?: string | null;
}): Promise<ResourceListResult> => {
  const clampedLimit = Math.min(Math.max(1, limit), RESOURCE_LIST_MAX_LIMIT);
  const decoded = cursor ? decodeCursor<SortKeyCursor>(cursor) : undefined;

  // DB-level pagination: WHERE sort_key > cursor LIMIT N+1. The +1 lets us
  // detect whether a next page exists without a second round trip.
  const rows = await db.query.resourceCollectionItems.findMany({
    where: decoded
      ? { collectionId, sortKey: { gt: decoded.value } }
      : { collectionId },
    orderBy: { sortKey: 'asc' },
    limit: clampedLimit + 1,
    with: {
      resource: {
        with: { attachment: { with: { storageObject: true } } },
      },
    },
  });

  const pageItems = rows.slice(0, clampedLimit);
  const hasMore = rows.length > clampedLimit;

  const items = await Promise.all(
    pageItems.map(async (item) => {
      const base = await getResource(item.resource);
      return { ...base, collectionId, sortKey: item.sortKey };
    }),
  );

  const lastSortKey = pageItems[pageItems.length - 1]?.sortKey;
  const next =
    hasMore && lastSortKey
      ? encodeCursor<SortKeyCursor>({ value: lastSortKey })
      : null;
  return { collectionId, items, next };
};
