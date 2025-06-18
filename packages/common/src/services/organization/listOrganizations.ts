import { and, db, eq, lt, or, sql } from '@op/db/client';
import { locations, organizations } from '@op/db/schema';
import { User } from '@op/supabase/lib';

import {
  NotFoundError,
  UnauthorizedError,
  decodeCursor,
  encodeCursor,
} from '../../utils';

const getOrderByColumn = (orderBy: string) => {
  switch (orderBy) {
    case 'updatedAt':
      return organizations.updatedAt;
    case 'createdAt':
      return organizations.createdAt;
    default:
      return organizations.updatedAt;
  }
};

export const listOrganizations = async ({
  cursor,
  user,
  limit = 10,
  orderBy = 'updatedAt',
  dir = 'desc',
}: {
  user: User;
  cursor?: string | null;
  limit?: number;
  orderBy?: string;
  dir?: 'asc' | 'desc';
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

    const orderByColumn = getOrderByColumn(orderBy);

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
        whereWeWork: {
          with: {
            location: {
              extras: {
                x: sql<number>`ST_X(${locations.location})`.as('x'),
                y: sql<number>`ST_Y(${locations.location})`.as('y'),
              },
              columns: {
                id: true,
                name: true,
                placeId: true,
                countryCode: true,
                countryName: true,
                metadata: true,
                latLng: false,
              },
            },
          },
        },
      },
      orderBy: (_, { asc, desc }) =>
        dir === 'asc' ? asc(orderByColumn) : desc(orderByColumn),
      limit: limit + 1, // Fetch one extra to check hasMore
    });

    if (!result) {
      throw new NotFoundError('Organizations not found');
    }

    result.forEach((org) => {
      org.whereWeWork = org.whereWeWork.map((item) => item.location);
    });

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
