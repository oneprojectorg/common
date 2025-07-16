import { and, db, eq, lt, or } from '@op/db/client';
import { organizations, postsToOrganizations, profiles } from '@op/db/schema';
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
  slug,
  limit = 20,
  cursor,
}: {
  user: User;
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
          with: {
            attachments: {
              with: {
                storageObject: true,
              },
            },
            reactions: true,
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

    const hasMore = result.length > limit;
    const items = hasMore ? result.slice(0, limit) : result;
    const lastItem = items[items.length - 1];
    const nextCursor =
      hasMore && lastItem && lastItem.createdAt
        ? encodeCursor(new Date(lastItem.createdAt), lastItem.postId)
        : null;

    const actorProfileId = await getCurrentProfileId({ database: db });
    // Transform items to include reaction counts and user's reactions
    const itemsWithReactions = getItemsWithReactions({
      items,
      profileId: actorProfileId,
    });

    return {
      items: itemsWithReactions,
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
export const getItemsWithReactions = ({
  items,
  profileId,
}: {
  items: any[];
  profileId: string;
}): Array<any & { post: any & { reactionCounts: Record<string, number>; userReaction: string | null } }> =>
  items.map((item) => {
    const reactionCounts: Record<string, number> = {};
    let userReaction: string | null = null;

    // Count reactions by type
    if (item.post.reactions) {
      item.post.reactions.forEach((reaction: { reactionType: string; profileId: string }) => {
        reactionCounts[reaction.reactionType] =
          (reactionCounts[reaction.reactionType] || 0) + 1;

        // Track user's reaction (only one per user)
        if (reaction.profileId === profileId) {
          userReaction = reaction.reactionType;
        }
      });
    }

    return {
      ...item,
      post: {
        ...item.post,
        reactionCounts,
        userReaction,
      },
    };
  });
