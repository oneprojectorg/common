import { and, db, eq, lt, or } from '@op/db/client';
import { postsToOrganizations, profiles } from '@op/db/schema';
import { User } from '@op/supabase/lib';

import {
  NotFoundError,
  UnauthorizedError,
  decodeCursor,
  encodeCursor,
} from '../../utils';

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
    const org = await db.query.organizations.findFirst({
      where: (_, { eq }) => eq(profiles.slug, slug),
    });

    if (!org) {
      throw new NotFoundError('Organization not found');
    }

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

    return {
      items,
      next: nextCursor,
      hasMore,
    };
  } catch (e) {
    console.error(e);
    throw e;
  }
};
