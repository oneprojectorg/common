import { and, db, eq, lt, or } from '@op/db/client';
import { organizations } from '@op/db/schema';
import { User } from '@op/supabase/lib';

import {
  NotFoundError,
  UnauthorizedError,
  decodeCursor,
  encodeCursor,
} from '../../utils';

export const listOrganizations = async ({
  cursor,
  user,
  limit = 10,
}: {
  user: User;
  cursor?: string | null;
  limit?: number;
}) => {
  if (!user) {
    throw new UnauthorizedError();
  }

  try {
    const cursorData = cursor ? decodeCursor(cursor) : null;

    // Build cursor condition for unfiltered query
    const cursorCondition = cursorData
      ? or(
          lt(organizations.updatedAt, cursorData.updatedAt),
          and(
            eq(organizations.updatedAt, cursorData.updatedAt),
            lt(organizations.id, cursorData.id),
          ),
        )
      : undefined;

    // TODO: assert authorization, setup a common package
    const result = await db.query.organizations.findMany({
      where: cursorCondition,
      with: {
        projects: true,
        links: true,
        profile: {
          with: {
            headerImage: true,
            avatarImage: true,
          },
        },
      },
      orderBy: (orgs, { desc }) => desc(orgs.updatedAt),
      limit: limit + 1, // Fetch one extra to check hasMore
    });

    if (!result) {
      throw new NotFoundError('Organizations not found');
    }

    const hasMore = result.length > limit;
    const items = hasMore ? result.slice(0, limit) : result;
    const lastItem = items[items.length - 1];
    const nextCursor =
      hasMore && lastItem && lastItem.updatedAt
        ? encodeCursor(new Date(lastItem.updatedAt), lastItem.id)
        : null;

    return { items, next: nextCursor, hasMore };
  } catch (error) {
    console.error(error);
    throw error;
  }
};
