import {
  and,
  count,
  db,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from '@op/db/client';
import { posts, postsToOrganizations, profiles } from '@op/db/schema';
import { logger } from '@op/logging';
import { checkPermission, permission } from 'access-zones';
import type { SQL } from 'drizzle-orm';

import {
  NotFoundError,
  decodeCursor,
  encodeCursor,
  getGenericCursorCondition,
} from '../../utils';
import { getCurrentProfileId, getOrgAccessUser } from '../access';
import {
  getActivelyFlaggedItemIds,
  noActiveModerationFlag,
} from '../moderation/moderationVisibility';
import {
  getLikeSummary,
  type LikeSummary,
  type ReactionRow,
} from '../reactions/utils';

/**
 * SQL filter for post/comment reads: the row carries no active moderation flag,
 * or `actorProfileId` authored it. Pass the (possibly aliased) posts table the
 * surrounding query builds against. Admins skip moderation entirely, so callers
 * compose that exception themselves:
 * `isAdmin ? undefined : postModerationFilter(table, actorProfileId)`.
 */
export const postModerationFilter = (
  table: typeof posts,
  actorProfileId: string | undefined,
): SQL =>
  or(
    noActiveModerationFlag('post', table.id),
    actorProfileId ? eq(table.profileId, actorProfileId) : sql`false`,
  )!;

export const listPosts = async ({
  authUserId,
  slug,
  limit = 20,
  cursor,
}: {
  authUserId: string;
  slug: string;
  limit?: number;
  cursor?: string | null;
}) => {
  try {
    // Build cursor condition for pagination
    const cursorCondition = cursor
      ? getGenericCursorCondition({
          columns: {
            id: postsToOrganizations.postId,
            date: postsToOrganizations.createdAt,
          },
          cursor: decodeCursor(cursor),
        })
      : undefined;

    const profile = slug
      ? await db
          .select({ id: profiles.id })
          .from(profiles)
          .where(eq(profiles.slug, slug))
          .limit(1)
      : null;

    const profileId = profile?.[0]?.id;

    if (!profileId) {
      throw new NotFoundError('Organization', slug);
    }

    const org = await db.query.organizations.findFirst({
      where: { profileId },
    });

    if (!org) {
      logger.error('Could not find org while listing posts', {
        profileId,
        slug,
      });
      throw new NotFoundError('Organization', profileId);
    }

    // The caller's profile + org-admin standing drive the moderation filter:
    // flagged posts stay visible to their author and to admins of the org, and
    // are hidden from everyone else (filtered in SQL). Org-admin roles live on
    // `organizationUsers` (not `profileUsers`), so resolve them via
    // `getOrgAccessUser` — a `getProfileAccessUser` lookup on the org's profile
    // never sees them and would hide flagged posts from admins too.
    const [actorProfileId, orgUser] = await Promise.all([
      getCurrentProfileId(authUserId),
      getOrgAccessUser({ user: { id: authUserId }, organizationId: org.id }),
    ]);
    const isOrgAdmin = checkPermission(
      { profile: permission.ADMIN },
      orgUser?.roles ?? [],
    );

    // Page the post ids on the join itself (top-level + moderation filters on
    // the paginated root), so a flagged or comment row never occupies a page
    // slot or distorts hasMore/nextCursor. A nested relational `with` would
    // LEFT JOIN and null the relation while still consuming the slot — see
    // listProfilePosts for the same two-stage pattern.
    const moderationFilter = isOrgAdmin
      ? undefined
      : postModerationFilter(posts, actorProfileId);

    const pageRows = await db
      .select({
        postId: postsToOrganizations.postId,
        createdAt: postsToOrganizations.createdAt,
      })
      .from(postsToOrganizations)
      .innerJoin(
        posts,
        and(
          eq(posts.id, postsToOrganizations.postId),
          isNull(posts.parentPostId), // Only show top-level posts
          moderationFilter,
        ),
      )
      .where(
        cursorCondition
          ? and(
              eq(postsToOrganizations.organizationId, org.id),
              cursorCondition,
            )
          : eq(postsToOrganizations.organizationId, org.id),
      )
      .orderBy(
        desc(postsToOrganizations.createdAt),
        desc(postsToOrganizations.postId),
      )
      .limit(limit + 1);

    const hasMore = pageRows.length > limit;
    const pageItems = pageRows.slice(0, limit);
    const pageIds = pageItems.map((row) => row.postId);

    // Hydrate the paged ids (the moderation/top-level filtering already
    // happened above). Re-ordered to the page order below, since `inArray`
    // doesn't preserve it.
    const hydrated = pageIds.length
      ? await db.query.postsToOrganizations.findMany({
          where: {
            organizationId: org.id,
            postId: { in: pageIds },
          },
          with: {
            post: {
              with: {
                attachments: {
                  with: {
                    storageObject: true,
                  },
                },
                reactions: {
                  with: {
                    profile: true,
                  },
                },
              },
            },
            organization: {
              with: {
                profile: {
                  with: {
                    avatarImage: true,
                  },
                },
              },
            },
          },
        })
      : [];

    const byPostId = new Map(hydrated.map((row) => [row.postId, row]));
    const items = pageIds
      .map((id) => byPostId.get(id))
      .filter((row): row is NonNullable<typeof row> => row != null);

    const lastItem = pageItems[pageItems.length - 1];
    const nextCursor =
      hasMore && lastItem && lastItem.createdAt
        ? encodeCursor({
            date: new Date(lastItem.createdAt),
            id: lastItem.postId,
          })
        : null;

    // Transform items to include reaction counts, user's reactions, and comment counts
    const itemsWithReactionsAndComments =
      await getItemsWithReactionsAndComments({
        items,
        profileId: actorProfileId,
      });

    return { items: itemsWithReactionsAndComments, next: nextCursor };
  } catch (e) {
    logger.error('Error listing posts', { error: e });
    throw e;
  }
};

/**
 * Fields added to posts by this function
 */
type EnhancedPostFields = LikeSummary & {
  commentCount: number;
  /** True when an active moderation flag hides this post from general readers.
   *  Only the author and admins ever receive a flagged post (the read filters
   *  exclude it for everyone else), so this drives their "Flagged" indicator. */
  isFlagged: boolean;
};

/**
 * Processes posts to add like counts and comment counts.
 *
 * Note: The generic constraint uses `any` for the `post` parameter to remain compatible
 * with Drizzle's loosely-typed query results. Within the function, we process reactions
 * with proper type safety using the `ReactionRow` type.
 *
 * @param items - Array of items where each has a post with id and optional reactions array
 * @param profileId - The current user's profile ID to determine whether they liked it
 * @returns Items with enhanced post data including like counts and comment counts
 */
export const getItemsWithReactionsAndComments = async <
  T extends { post: any },
>({
  items,
  profileId,
}: {
  items: T[];
  profileId?: string;
}): Promise<Array<T & { post: T['post'] & EnhancedPostFields }>> => {
  // Get all post IDs to fetch comment counts
  const postIds = items.map((item) => item.post.id).filter(Boolean);

  // Flagged posts only reach enrichment for their author or an admin (the read
  // filters drop them for everyone else), so this decorates exactly the people
  // who should see the "Flagged" indicator.
  const flaggedIds = await getActivelyFlaggedItemIds('post', postIds);

  // Fetch comment counts for all posts in a single query
  const commentCountMap: Record<string, number> = {};
  if (postIds.length > 0) {
    const commentCounts = await db
      .select({
        parentPostId: posts.parentPostId,
        count: count(posts.id),
      })
      .from(posts)
      .where(
        and(
          isNotNull(posts.parentPostId),
          inArray(posts.parentPostId, postIds),
        ),
      )
      .groupBy(posts.parentPostId);

    commentCounts.forEach((row) => {
      if (row.parentPostId) {
        commentCountMap[row.parentPostId] = Number(row.count);
      }
    });
  }

  return items.map((item) => {
    const reactions: ReactionRow[] = item.post.reactions ?? [];

    // Get comment count for this post
    const commentCount = commentCountMap[item.post.id] || 0;

    return {
      ...item,
      post: {
        ...item.post,
        ...getLikeSummary({ reactions, profileId }),
        commentCount,
        isFlagged: flaggedIds.has(item.post.id),
      },
    };
  });
};
