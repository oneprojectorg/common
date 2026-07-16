import { db } from '@op/db/client';
import { logger } from '@op/logging';

import { decodeCursor, encodeCursor, getCursorCondition } from '../../utils';

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
    const decodedCursor = cursor
      ? decodeCursor<{ value: string | Date }>(cursor)
      : undefined;

    // Step 1: page the organization ids on the bare table. The cursor/order/
    // limit run against an index-backed scan, so the expensive per-relation
    // aggregation never fans out across the whole table (ONE-392).
    const page = await db.query.organizations.findMany({
      where: decodedCursor
        ? {
            RAW: (table) =>
              getCursorCondition({
                column: table[orderBy],
                cursor: decodedCursor,
                direction: dir,
              }),
          }
        : undefined,
      columns: {
        id: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: (table, { asc, desc }) =>
        dir === 'asc' ? asc(table[orderBy]) : desc(table[orderBy]),
      limit: limit + 1, // Fetch one extra to check hasMore
    });

    const hasMore = page.length > limit;
    const pageItems = page.slice(0, limit);
    const pageIds = pageItems.map((org) => org.id);

    // Step 2: hydrate only the paged ids with their relations. `in` does not
    // preserve order, so re-order to the page order below.
    const hydrated = pageIds.length
      ? await db.query.organizations.findMany({
          where: { id: { in: pageIds } },
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
        })
      : [];

    const byId = new Map(hydrated.map((org) => [org.id, org]));
    const items = pageIds
      .map((id) => byId.get(id))
      .filter((org): org is NonNullable<typeof org> => org != null)
      .map((org) => ({
        ...org,
        whereWeWork: org.whereWeWork.map((item) => item.location),
      }));

    const lastItem = pageItems[pageItems.length - 1];

    const orderByValue =
      orderBy === 'createdAt' ? lastItem?.createdAt : lastItem?.updatedAt;
    const cursorValue = orderByValue ? new Date(orderByValue) : null;

    const nextCursor =
      hasMore && lastItem && cursorValue
        ? encodeCursor<{ value: Date }>({ value: cursorValue })
        : null;

    return { items, next: nextCursor };
  } catch (error) {
    logger.error('Error listing organizations', { error });
    throw error;
  }
};
