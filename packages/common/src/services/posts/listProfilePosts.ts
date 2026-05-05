import { db } from '@op/db/client';
import {
  EntityType,
  posts as postsTable,
  postsToProfiles,
} from '@op/db/schema';
import { permission } from 'access-zones';
import { and, desc, eq, isNull } from 'drizzle-orm';

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

  // Filter top-level posts at the SQL level so pagination doesn't under-fetch
  // when comments inherit profile associations from their parent. A relational
  // `where: { post: { parentPostId: isNull } }` produces a LEFT JOIN that
  // returns nulls for filtered rows — paginating on those rows silently drops
  // pages.
  const pageRows = await db
    .select({
      postId: postsToProfiles.postId,
      createdAt: postsToProfiles.createdAt,
    })
    .from(postsToProfiles)
    .innerJoin(
      postsTable,
      and(
        eq(postsTable.id, postsToProfiles.postId),
        isNull(postsTable.parentPostId),
      ),
    )
    .where(
      cursorCondition
        ? and(eq(postsToProfiles.profileId, profileId), cursorCondition)
        : eq(postsToProfiles.profileId, profileId),
    )
    .orderBy(desc(postsToProfiles.createdAt), desc(postsToProfiles.postId))
    .limit(limit + 1);

  const hasMore = pageRows.length > limit;
  const pageItems = pageRows.slice(0, limit);
  const postIds = pageItems.map((row) => row.postId);

  const hydrated = postIds.length
    ? await db.query.posts.findMany({
        where: { id: { in: postIds } },
        with: {
          profile: { with: { avatarImage: true } },
          attachments: { with: { storageObject: true } },
          reactions: { with: { profile: true } },
        },
      })
    : [];

  const postById = new Map(hydrated.map((post) => [post.id, post]));
  const orderedPosts = postIds
    .map((id) => postById.get(id))
    .filter((post): post is NonNullable<typeof post> => post !== undefined);

  const lastItem = pageItems[pageItems.length - 1];
  const nextCursor =
    hasMore && lastItem && lastItem.createdAt
      ? encodeCursor({
          date: new Date(lastItem.createdAt),
          id: lastItem.postId,
        })
      : null;

  const actorProfileId = await getCurrentProfileId(authUserId);
  const itemsWithReactions = await getItemsWithReactionsAndComments({
    items: orderedPosts.map((post) => ({ post })),
    profileId: actorProfileId,
  });

  return {
    items: itemsWithReactions.map((item) => item.post),
    next: nextCursor,
  };
};
