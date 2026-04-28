import { db } from '@op/db/client';
import { organizations } from '@op/db/schema';

import {
  NotFoundError,
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

    const decodedCursor = cursor
      ? decodeCursor<{ value: string | Date }>(cursor)
      : undefined;

    const result = await db.query.organizations.findMany({
      where: decodedCursor
        ? {
            RAW: () =>
              getCursorCondition({
                column: orderByColumn,
                cursor: decodedCursor,
                direction: dir,
              }),
          }
        : undefined,
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
                x: (table, { sql }) =>
                  sql<number>`ST_X(${table.location})`.as('x'),
                y: (table, { sql }) =>
                  sql<number>`ST_Y(${table.location})`.as('y'),
              },
              columns: {
                id: true,
                name: true,
                placeId: true,
                countryCode: true,
                countryName: true,
                metadata: true,
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

    const flattened = result.map((org) => ({
      ...org,
      whereWeWork: org.whereWeWork.map((item) => item.location),
    }));

    const hasMore = flattened.length > limit;
    const items = flattened.slice(0, limit);
    const lastItem = items[items.length - 1];

    const orderByValue =
      orderBy === 'createdAt' ? lastItem?.createdAt : lastItem?.updatedAt;
    const cursorValue = orderByValue ? new Date(orderByValue) : null;

    const nextCursor =
      hasMore && lastItem && cursorValue
        ? encodeCursor<{ value: Date }>({ value: cursorValue })
        : null;

    return { items, next: nextCursor };
  } catch (error) {
    console.error(error);
    throw error;
  }
};
