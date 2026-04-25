import { match } from '@op/core';
import { db } from '@op/db/client';
import { type EntityType } from '@op/db/schema';

import {
  NotFoundError,
  decodeCursor,
  encodeCursor,
  getCursorCondition,
} from '../../utils';

export const listProfiles = async ({
  cursor,
  limit = 10,
  orderBy = 'updatedAt',
  dir = 'desc',
  types,
}: {
  cursor?: string | null;
  limit?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'name';
  dir?: 'asc' | 'desc';
  types?: EntityType[];
}) => {
  try {
    const decodedCursor = cursor
      ? decodeCursor<{ value: string | Date; id?: string }>(cursor)
      : undefined;

    const result = await db.query.profiles.findMany({
      where: {
        ...(types && types.length > 0 && { type: { in: types } }),
        ...(decodedCursor && {
          RAW: (table) => {
            const col = match(orderBy, {
              name: table.name,
              createdAt: table.createdAt,
              _: table.updatedAt,
            });
            const tieBreaker = orderBy === 'name' ? table.id : undefined;
            return getCursorCondition({
              column: col,
              tieBreakerColumn: tieBreaker,
              cursor: decodedCursor,
              direction: dir,
            })!;
          },
        }),
      },
      with: {
        headerImage: true,
        avatarImage: true,
        organization: {
          with: {
            projects: true,
            links: true,
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
        },
      },
      orderBy: (table, { asc, desc }) => {
        const col = match(orderBy, {
          name: table.name,
          createdAt: table.createdAt,
          _: table.updatedAt,
        });
        return dir === 'asc' ? asc(col) : desc(col);
      },
      limit: limit + 1, // Fetch one extra to check hasMore
    });

    if (!result) {
      throw new NotFoundError('Profiles not found');
    }

    const flattened = result.map((profile) => ({
      ...profile,
      organization: profile.organization
        ? {
            ...profile.organization,
            whereWeWork: profile.organization.whereWeWork.map(
              (item) => item.location,
            ),
          }
        : null,
    }));

    const hasMore = flattened.length > limit;
    const items = flattened.slice(0, limit);
    const lastItem = items[items.length - 1];

    const cursorValue = match(orderBy, {
      name: lastItem?.name ?? null,
      createdAt: lastItem?.createdAt ? new Date(lastItem.createdAt) : null,
      _: lastItem?.updatedAt ? new Date(lastItem.updatedAt) : null,
    });

    const nextCursor =
      hasMore && lastItem && cursorValue
        ? encodeCursor<{ value: string | Date; id?: string }>({
            value: cursorValue,
            id: orderBy === 'name' ? lastItem.id : undefined,
          })
        : null;

    return { items, next: nextCursor };
  } catch (error) {
    console.error('Error in listProfiles:', error);
    throw error;
  }
};
