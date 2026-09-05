import { db } from '@op/db/client';
import { posts as postsTable, postsToProfiles } from '@op/db/schema';
import { checkPermission, permission } from 'access-zones';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';

import {
  PAGE_LIMIT,
  decodeCursor,
  encodeCursor,
  getGenericCursorCondition,
} from '../../utils';
import {
  type AccessUser,
  getCurrentProfileId,
  getProfileAccessRolesWithOrgFallback,
} from '../access';
import {
  getItemsWithLikesAndComments,
  postModerationFilter,
} from './listPosts';

/**
 * One page of top-level posts across `profileIds`, newest first, each item
 * tagged with the profile it is linked to so a caller reading several feeds at
 * once can tell them apart.
 *
 * Does no authorization — every caller asserts read access itself, because the
 * grant a profile's posts hang off depends on the profile's type.
 *
 * `moderationProfileId` is the profile whose admin standing decides whether
 * flagged posts stay visible, and it is resolved once for the whole page — so
 * pass a profile whose admins are entitled to moderate *every* profile in
 * `profileIds`. In practice that means the decision's own profile: it governs
 * its proposals as well as itself, which a single proposal's profile does not.
 * `assertPostReadAccess` returns the right id for either profile type.
 */
export const getPostsPageForProfiles = async ({
  user,
  profileIds,
  moderationProfileId,
  limit = PAGE_LIMIT.md,
  cursor,
}: {
  user: AccessUser | undefined;
  profileIds: string[];
  moderationProfileId: string;
  limit?: number;
  cursor?: string | null;
}) => {
  const decodedCursor = cursor ? decodeCursor(cursor) : undefined;

  const cursorCondition = decodedCursor
    ? getGenericCursorCondition({
        columns: {
          id: postsToProfiles.postId,
          date: postsToProfiles.createdAt,
        },
        cursor: decodedCursor,
      })
    : undefined;

  // The caller's profile + admin standing on the governing profile drive the
  // moderation filter below: flagged posts stay visible to their author and
  // to the governing profile's admins, hidden from everyone else.
  const [actorProfileId, governingRoles] = await Promise.all([
    user ? getCurrentProfileId(user.id) : undefined,
    getProfileAccessRolesWithOrgFallback({
      user,
      profileId: moderationProfileId,
    }),
  ]);
  const isProfileAdmin = checkPermission(
    { profile: permission.ADMIN },
    governingRoles,
  );

  // Filter top-level posts at the SQL level so pagination doesn't under-fetch
  // when comments inherit profile associations from their parent. A relational
  // `where: { post: { parentPostId: isNull } }` produces a LEFT JOIN that
  // returns nulls for filtered rows — paginating on those rows silently drops
  // pages. The moderation filter rides on the same join for the same reason.
  const profileScope = inArray(postsToProfiles.profileId, profileIds);
  const pageRows = await db
    .select({
      postId: postsToProfiles.postId,
      profileId: postsToProfiles.profileId,
      createdAt: postsToProfiles.createdAt,
    })
    .from(postsToProfiles)
    .innerJoin(
      postsTable,
      and(
        eq(postsTable.id, postsToProfiles.postId),
        isNull(postsTable.parentPostId),
        isProfileAdmin
          ? undefined
          : postModerationFilter(postsTable, actorProfileId),
      ),
    )
    .where(cursorCondition ? and(profileScope, cursorCondition) : profileScope)
    .orderBy(desc(postsToProfiles.createdAt), desc(postsToProfiles.postId))
    .limit(limit + 1);

  const hasMore = pageRows.length > limit;
  const pageItems = pageRows.slice(0, limit);
  const postIds = pageItems.map((row) => row.postId);

  // The moderation filter is reapplied here, not just on the id page above: a
  // flag landing between the two queries would otherwise hand this reader the
  // full content — and, via `isFlagged`, the moderation state — of a post the
  // page query would now exclude. A row dropped here just shortens the page;
  // the reorder below already tolerates a missing post.
  const hydrated = postIds.length
    ? await db.query.posts.findMany({
        where: {
          RAW: (table) =>
            isProfileAdmin
              ? inArray(table.id, postIds)
              : and(
                  inArray(table.id, postIds),
                  postModerationFilter(table, actorProfileId),
                )!,
        },
        with: {
          profile: { with: { avatarImage: true } },
          attachments: { with: { storageObject: true } },
          reactions: { with: { profile: true } },
        },
      })
    : [];

  const postById = new Map(hydrated.map((post) => [post.id, post]));
  // `in` doesn't preserve the paged order, so reapply it here.
  const orderedItems = pageItems.flatMap((row) => {
    const post = postById.get(row.postId);
    return post ? [{ post, profileId: row.profileId }] : [];
  });

  const lastItem = pageItems[pageItems.length - 1];
  const next =
    hasMore && lastItem && lastItem.createdAt != null
      ? encodeCursor({
          date: new Date(lastItem.createdAt),
          id: lastItem.postId,
        })
      : null;

  const items = await getItemsWithLikesAndComments({
    items: orderedItems,
    profileId: actorProfileId,
  });

  return { items, next };
};
