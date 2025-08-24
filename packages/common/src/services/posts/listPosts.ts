import { and, count, db, eq, inArray, isNotNull, lt, or } from '@op/db/client';
import {
  organizations,
  posts,
  postsToOrganizations,
  profiles,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';

import {
  NotFoundError,
  UnauthorizedError,
  decodeCursor,
  encodeCursor,
} from '../../utils';
import { getCurrentProfileId } from '../access';

export const listPosts = async ({
  user,
  authUserId,
  slug,
  limit = 20,
  cursor,
}: {
  user: User;
  authUserId: string;
  slug: string;
  limit?: number;
  cursor?: string | null;
}) => {
  if (!user) {
    throw new UnauthorizedError();
  }

  try {
    // Parse cursor
    const cursorData = cursor ? decodeCursor(cursor) : null;

    // Build cursor condition for pagination
    const cursorCondition = cursorData
      ? or(
          lt(postsToOrganizations.createdAt, cursorData.createdAt),
          and(
            eq(postsToOrganizations.createdAt, cursorData.createdAt),
            lt(postsToOrganizations.postId, cursorData.id),
          ),
        )
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

    const org = await db.query.organizations.findFirst({
      where: (_, { eq }) => eq(organizations.profileId, profileId),
    });

    if (!org) {
      throw new NotFoundError('Organization not found');
    }

    const result = await db.query.postsToOrganizations.findMany({
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
    const items = hasMore ? filteredResult.slice(0, limit) : filteredResult;
    const lastItem = items[items.length - 1];
    const nextCursor =
      hasMore && lastItem && lastItem.createdAt
        ? encodeCursor(new Date(lastItem.createdAt), lastItem.postId)
        : null;

    const actorProfileId = await getCurrentProfileId(authUserId);
    // Transform items to include reaction counts, user's reactions, and comment counts
    const itemsWithReactionsAndComments =
      await getItemsWithReactionsAndComments({
        items,
        profileId: actorProfileId,
      });

    return {
      items: itemsWithReactionsAndComments,
      next: nextCursor,
      hasMore,
    };
  } catch (e) {
    console.error(e);
    throw e;
  }
};

// Using `any` here because the Drizzle query result has a complex nested structure
// that's difficult to type precisely. The function is type-safe internally.
export const getItemsWithReactionsAndComments = async ({
  items,
  profileId,
}: {
  items: any[];
  profileId: string;
}): Promise<
  Array<
    any & {
      post: any & {
        reactionCounts: Record<string, number>;
        reactionUsers: Record<
          string,
          Array<{ id: string; name: string; timestamp: Date }>
        >;
        userReaction: string | null;
        commentCount: number;
      };
    }
  >
> => {
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
      item.post.reactions.forEach((reaction: any) => {
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
