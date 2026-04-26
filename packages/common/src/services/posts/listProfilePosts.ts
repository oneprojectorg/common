import { and, db } from '@op/db/client';
import { postsToProfiles } from '@op/db/schema';
import { permission } from 'access-zones';
import { eq } from 'drizzle-orm';

import {
  decodeCursor,
  encodeCursor,
  getGenericCursorCondition,
} from '../../utils';
import {
  assertDecisionProfilesAccess,
  getCurrentProfileId,
} from '../access';
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
  await assertDecisionProfilesAccess({
    user: { id: authUserId },
    profileIds: [profileId],
    requiredPermission: { decisions: permission.READ },
  });

  const cursorCondition = cursor
    ? getGenericCursorCondition({
        columns: {
          id: postsToProfiles.postId,
          date: postsToProfiles.createdAt,
        },
        cursor: decodeCursor(cursor),
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
