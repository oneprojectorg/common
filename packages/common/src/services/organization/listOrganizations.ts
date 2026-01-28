import { db, sql } from '@op/db/client';
import { locations, organizations } from '@op/db/schema';

import {
  NotFoundError,
  type PaginatedResult,
  decodeCursor,
  encodeCursor,
  getCursorCondition,
} from '../../utils';

export const listOrganizations = async ({
  cursor,
  limit = 10,
  orderBy = 'updatedAt',
  dir = 'desc',
}: {
  cursor?: string | null;
  limit?: number;
  orderBy?: 'createdAt' | 'updatedAt';
  dir?: 'asc' | 'desc';
}) => {
  try {
    const orderByColumn =
      orderBy === 'createdAt'
        ? organizations.createdAt
        : organizations.updatedAt;

    // Build cursor condition for unfiltered query
    const cursorCondition = cursor
      ? getCursorCondition({
          column: orderByColumn,
          cursor: decodeCursor<{ value: string | Date }>(cursor),
          direction: dir,
        })
      : undefined;

    const result = await db._query.organizations.findMany({
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
    const items = result.slice(0, limit);
    const lastItem = items[items.length - 1];

    const orderByValue =
      orderBy === 'createdAt' ? lastItem?.createdAt : lastItem?.updatedAt;
    const cursorValue = orderByValue ? new Date(orderByValue) : null;

    const nextCursor =
      hasMore && lastItem && cursorValue
        ? encodeCursor<{ value: Date }>({ value: cursorValue })
        : null;

    return { items, next: nextCursor } satisfies PaginatedResult<
      (typeof items)[number]
    >;
  } catch (error) {
    console.error(error);
    throw error;
  }
};
