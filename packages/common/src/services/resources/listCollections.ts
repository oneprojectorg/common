import { permission } from 'access-zones';

import { decodeCursor, encodeCursor } from '../../utils';
import { type AccessUser } from '../access';
import { assertProfileAccess } from '../assert';
import type { CollectionListResult } from './schemas';
import { RESOURCE_LIST_DEFAULT_LIMIT, RESOURCE_LIST_MAX_LIMIT } from './types';
import { getCollectionsForProfile } from './utils';

type SortKeyCursor = { value: string };

export const listCollections = async ({
  user,
  profileId,
  limit = RESOURCE_LIST_DEFAULT_LIMIT,
  cursor,
}: {
  user?: AccessUser;
  profileId: string;
  limit?: number;
  cursor?: string | null;
}): Promise<CollectionListResult> => {
  // Fail-closed: this endpoint is public, so require a decisions READ grant
  // (own or public), not the type-lenient pass-through.
  await assertProfileAccess({
    user,
    profileId,
    permissions: { decisions: permission.READ },
  });
  const clampedLimit = Math.min(Math.max(1, limit), RESOURCE_LIST_MAX_LIMIT);
  const decoded = cursor ? decodeCursor<SortKeyCursor>(cursor) : undefined;
  const rows = await getCollectionsForProfile({
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
