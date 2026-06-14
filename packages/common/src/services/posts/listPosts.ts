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
import {
  organizations,
  posts,
  postsToOrganizations,
  profiles,
} from '@op/db/schema';
import { checkPermission, permission } from 'access-zones';

import {
  NotFoundError,
  decodeCursor,
  encodeCursor,
  getGenericCursorCondition,
} from '../../utils';
import { getCurrentProfileId, getProfileAccessUser } from '../access';
import {
  getActivelyFlaggedItemIds,
  noActiveModerationFlag,
} from '../moderation/moderationVisibility';

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

    const org = await db._query.organizations.findFirst({
      where: (_, { eq }) => eq(organizations.profileId, profileId),
    });

    if (!org) {
      console.error('Could not find org while listing posts', {
        profileId,
        slug,
      });
      throw new NotFoundError('Organization', profileId);
    }

    // The caller's profile + org-admin standing drive the moderation filter:
    // flagged posts stay visible to their author and to admins of the org's
    // profile, and are hidden from everyone else (filtered in SQL).
    const [actorProfileId, orgProfileUser] = await Promise.all([
      getCurrentProfileId(authUserId),
      getProfileAccessUser({ user: { id: authUserId }, profileId }),
    ]);
    const isOrgAdmin = checkPermission(
      { profile: permission.ADMIN },
      orgProfileUser?.roles ?? [],
    );

    // Page the post ids on the join itself (top-level + moderation filters on
    // the paginated root), so a flagged or comment row never occupies a page
    // slot or distorts hasMore/nextCursor. A nested relational `with` would
    // LEFT JOIN and null the relation while still consuming the slot — see
    // listProfilePosts for the same two-stage pattern.
    const moderationFilter = isOrgAdmin
      ? undefined
      : or(
          noActiveModerationFlag('post', posts.id),
          actorProfileId ? eq(posts.profileId, actorProfileId) : sql`false`,
        );

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
      ? await db._query.postsToOrganizations.findMany({
          where: and(
            eq(postsToOrganizations.organizationId, org.id),
            inArray(postsToOrganizations.postId, pageIds),
          ),
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
    console.error(e);
    throw e;
  }
};

/**
 * Represents a reaction item with required fields for processing
 */
type ReactionItem = {
  reactionType: string;
  createdAt?: string | Date | null;
  profileId: string;
  profile?: {
    id: string;
    name: string;
  } | null;
};

/**
 * Fields added to posts by this function
 */
type EnhancedPostFields = {
  reactionCounts: Record<string, number>;
  reactionUsers: Record<
    string,
    Array<{ id: string; name: string; timestamp: Date }>
  >;
  userReaction: string | null;
  commentCount: number;
  /** True when an active moderation flag hides this post from general readers.
   *  Only the author and admins ever receive a flagged post (the read filters
   *  exclude it for everyone else), so this drives their "Flagged" indicator. */
  isFlagged: boolean;
};

/**
 * Processes posts to add reaction counts, user reactions, and comment counts.
 *
 * Note: The generic constraint uses `any` for the `post` parameter to remain compatible
 * with Drizzle's loosely-typed query results. Within the function, we process reactions
 * with proper type safety using the `ReactionItem` type.
 *
 * @param items - Array of items where each has a post with id and optional reactions array
 * @param profileId - The current user's profile ID to determine their reaction
 * @returns Items with enhanced post data including reaction counts and comment counts
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
    const reactionCounts: Record<string, number> = {};
    const reactionUsers: Record<
      string,
      Array<{ id: string; name: string; timestamp: Date }>
    > = {};
    let userReaction: string | null = null;

    // Count reactions by type and collect user info
    if (item.post.reactions) {
      item.post.reactions.forEach((reaction: ReactionItem) => {
        reactionCounts[reaction.reactionType] =
          (reactionCounts[reaction.reactionType] || 0) + 1;

        // Collect user data for each reaction type
        if (!reactionUsers[reaction.reactionType]) {
          reactionUsers[reaction.reactionType] = [];
        }

        // Only add user data if profile exists
        if (reaction.profile) {
          const timestamp = reaction.createdAt
            ? new Date(reaction.createdAt)
            : new Date();

          // Ensure the date is valid
          const validTimestamp = isNaN(timestamp.getTime())
            ? new Date()
            : timestamp;

          reactionUsers[reaction.reactionType]?.push({
            id: reaction.profile.id,
            name: reaction.profile.name,
            timestamp: validTimestamp,
          });
        }

        // Track user's reaction (only one per user)
        if (reaction.profileId === profileId) {
          userReaction = reaction.reactionType;
        }
      });
    }

    // Get comment count for this post
    const commentCount = commentCountMap[item.post.id] || 0;

    return {
      ...item,
      post: {
        ...item.post,
        reactionCounts,
        reactionUsers, // Add user data grouped by reaction type
        userReaction,
        commentCount,
        isFlagged: flaggedIds.has(item.post.id),
      },
    };
  });
};
