import { and, count, db, eq, inArray, isNotNull } from '@op/db/client';
import {
  organizations,
  posts,
  postsToOrganizations,
  profiles,
} from '@op/db/schema';

import {
  NotFoundError,
  decodeCursor,
  encodeCursor,
  getGenericCursorCondition,
} from '../../utils';
import { getCurrentProfileId } from '../access';

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
      throw new NotFoundError('Could not find organization');
    }

    const org = await db._query.organizations.findFirst({
      where: (_, { eq }) => eq(organizations.profileId, profileId),
    });

    if (!org) {
      console.error('Could not find org while listing posts', {
        profileId,
        slug,
      });
      throw new NotFoundError('Organization not found');
    }

    const result = await db._query.postsToOrganizations.findMany({
      where: cursorCondition
        ? and(eq(postsToOrganizations.organizationId, org.id), cursorCondition)
        : (table, { eq }) => eq(table.organizationId, org.id),
      with: {
        post: {
          where: (table, { isNull }) => isNull(table.parentPostId), // Only show top-level posts
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
      orderBy: (table, { desc }) => desc(table.createdAt),
      limit: limit + 1, // Fetch one extra to check hasMore
    });

    // Filter out any items where post is null (due to parentPostId filtering)
    const filteredResult = result.filter((item) => item.post !== null);

    const hasMore = filteredResult.length > limit;
    const items = filteredResult.slice(0, limit);
    const lastItem = items[items.length - 1];
    const nextCursor =
      hasMore && lastItem && lastItem.createdAt
        ? encodeCursor({
            date: new Date(lastItem.createdAt),
            id: lastItem.postId,
          })
        : null;

    const actorProfileId = await getCurrentProfileId(authUserId);
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
  profileId: string;
}): Promise<Array<T & { post: T['post'] & EnhancedPostFields }>> => {
  // Get all post IDs to fetch comment counts
  const postIds = items.map((item) => item.post.id).filter(Boolean);

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
      },
    };
  });
};
