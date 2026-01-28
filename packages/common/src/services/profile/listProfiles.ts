import { match } from '@op/core';
import { and, db, inArray, sql } from '@op/db/client';
import { type EntityType, locations, profiles } from '@op/db/schema';

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
    const orderByColumn = match(orderBy, {
      name: profiles.name,
      createdAt: profiles.createdAt,
      _: profiles.updatedAt,
    });

    // Build cursor condition for pagination
    const cursorCondition = cursor
      ? getCursorCondition({
          column: orderByColumn,
          tieBreakerColumn: orderBy === 'name' ? profiles.id : undefined,
          cursor: decodeCursor<{ value: string | Date; id?: string }>(cursor),
          direction: dir,
        })
      : undefined;

    // Build type filter condition
    const typeCondition =
      types && types.length > 0 ? inArray(profiles.type, types) : undefined;

    const whereConditions = [cursorCondition, typeCondition].filter(Boolean);
    const whereClause =
      whereConditions.length > 0
        ? whereConditions.length === 1
          ? whereConditions[0]
          : and(...whereConditions)
        : undefined;

    const result = await db._query.profiles.findMany({
      where: whereClause,
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
        },
      },
      orderBy: (_, { asc, desc }) =>
        dir === 'asc' ? asc(orderByColumn) : desc(orderByColumn),
      limit: limit + 1, // Fetch one extra to check hasMore
    });

    result.forEach((profile) => {
      if (profile.organization) {
        // @ts-expect-error - transitionary issue from org to profiles
        profile.organization.whereWeWork = // @ts-ignore - transitionary issue from org to profiles
          profile.organization?.whereWeWork.map((item: any) => item.location);
      }
    });

    if (!result) {
      throw new NotFoundError('Profiles not found');
    }

    const hasMore = result.length > limit;
    const items = result.slice(0, limit);
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
