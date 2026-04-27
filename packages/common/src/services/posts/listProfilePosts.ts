import { and, db } from '@op/db/client';
import { EntityType, postsToProfiles } from '@op/db/schema';
import { permission } from 'access-zones';
import { eq } from 'drizzle-orm';

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

  const cursorCondition = decodedCursor
    ? getGenericCursorCondition({
        columns: {
          id: postsToProfiles.postId,
          date: postsToProfiles.createdAt,
        },
        cursor: decodedCursor,
      })
    : undefined;

  const result = await db._query.postsToProfiles.findMany({
    where: cursorCondition
      ? and(eq(postsToProfiles.profileId, profileId), cursorCondition)
      : (table, { eq: eqOp }) => eqOp(table.profileId, profileId),
    with: {
      post: {
        where: (table, { isNull: isNullOp }) => isNullOp(table.parentPostId),
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
    orderBy: (table, { desc: descOp }) => descOp(table.createdAt),
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
