import { and, db, eq } from '@op/db/client';
import { EntityType } from '@op/db/schema';
import { permission } from 'access-zones';

import {
  decodeCursor,
  encodeCursor,
  getGenericCursorCondition,
} from '../../utils';
import { assertProfileTypeAccess, getCurrentProfileId } from '../access';
import { getItemsWithReactionsAndComments } from './listPosts';

export const listProfilePosts = async ({
  authUserId,
  profileId,
  limit = 20,
  cursor,
}: {
  authUserId: string;
  profileId: string;
  limit?: number;
  cursor?: string | null;
}) => {
  await assertProfileTypeAccess({
    user: { id: authUserId },
    profileIds: [profileId],
    policies: {
      [EntityType.DECISION]: { decisions: permission.READ },
    },
  });

  // Stale or hand-edited cursors fall back to the first page rather than
  // surfacing a 500 — the cursor is internal pagination state, not a
  // permission gate, so a malformed value is a UX glitch, not a security
  // event.
  const decodedCursor = (() => {
    if (!cursor) {
      return null;
    }
    try {
      return decodeCursor(cursor);
    } catch {
      return null;
    }
  })();

  const result = await db.query.postsToProfiles.findMany({
    where: {
      RAW: (table) =>
        and(
          eq(table.profileId, profileId),
          decodedCursor
            ? getGenericCursorCondition({
                columns: { id: table.postId, date: table.createdAt },
                cursor: decodedCursor,
              })
            : undefined,
        )!,
    },
    with: {
      post: {
        where: { parentPostId: { isNull: true } },
        with: {
          profile: {
            with: { avatarImage: true },
          },
          attachments: {
            with: { storageObject: true },
          },
          reactions: {
            with: { profile: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    limit: limit + 1,
  });

  const filtered = result.filter((item) => item.post !== null);
  const hasMore = filtered.length > limit;
  const items = filtered.slice(0, limit);
  const lastItem = items[items.length - 1];
  const nextCursor =
    hasMore && lastItem && lastItem.createdAt
      ? encodeCursor({
          date: new Date(lastItem.createdAt),
          id: lastItem.postId,
        })
      : null;

  const actorProfileId = await getCurrentProfileId(authUserId);
  const itemsWithReactions = await getItemsWithReactionsAndComments({
    items: items.map((item) => ({ post: item.post })),
    profileId: actorProfileId,
  });

  return {
    items: itemsWithReactions.map((item) => item.post),
    next: nextCursor,
  };
};
