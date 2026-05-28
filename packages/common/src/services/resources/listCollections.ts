import { db } from '@op/db/client';
import { EntityType } from '@op/db/schema';
import { permission } from 'access-zones';

import { decodeCursor, encodeCursor } from '../../utils';
import { assertProfileTypeAccess } from '../access';
import {
  type CollectionListResult,
  RESOURCE_LIST_DEFAULT_LIMIT,
  RESOURCE_LIST_MAX_LIMIT,
} from './types';
import { collectionsForProfileQuery } from './utils';

type SortKeyCursor = { value: string };

export const listCollections = async ({
  authUserId,
  profileId,
  limit = RESOURCE_LIST_DEFAULT_LIMIT,
  cursor,
}: {
  authUserId: string;
  profileId: string;
  limit?: number;
  cursor?: string | null;
}): Promise<CollectionListResult> => {
  await assertProfileTypeAccess({
    user: { id: authUserId },
    profileIds: [profileId],
    policies: {
      [EntityType.DECISION]: { decisions: permission.READ },
    },
  });
  const clampedLimit = Math.min(Math.max(1, limit), RESOURCE_LIST_MAX_LIMIT);
  const decoded = cursor ? decodeCursor<SortKeyCursor>(cursor) : undefined;
  const rows = await collectionsForProfileQuery({
    exec: db,
    profileId,
    limit: clampedLimit + 1,
    cursor: decoded?.value ?? null,
  });
  const pageItems = rows.slice(0, clampedLimit);
  const hasMore = rows.length > clampedLimit;
  const lastSortKey = pageItems[pageItems.length - 1]?.sortKey;
  const next =
    hasMore && lastSortKey
      ? encodeCursor<SortKeyCursor>({ value: lastSortKey })
      : null;
  return { items: pageItems, next };
};
