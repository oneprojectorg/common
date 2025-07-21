import { and, db, eq, inArray, lt, or, sql } from '@op/db/client';
import { EntityType, locations, profiles } from '@op/db/schema';
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
      return profiles.updatedAt;
    case 'createdAt':
      return profiles.createdAt;
    case 'name':
      return profiles.name;
    default:
      return profiles.updatedAt;
  }
};

export const listProfiles = async ({
  cursor,
  user,
  limit = 10,
  orderBy = 'updatedAt',
  dir = 'desc',
  types,
}: {
  user: User;
  cursor?: string | null;
  limit?: number;
  orderBy?: string;
  dir?: 'asc' | 'desc';
  types?: EntityType[];
}) => {
  if (!user) {
    throw new UnauthorizedError();
  }

  try {
    const cursorData = cursor ? decodeCursor(cursor) : null;

    // Build cursor condition for pagination
    const cursorCondition = cursorData
      ? or(
          lt(profiles.updatedAt, cursorData.updatedAt),
          and(
            eq(profiles.updatedAt, cursorData.updatedAt),
            lt(profiles.id, cursorData.id),
          ),
        )
      : undefined;

    // Build type filter condition
    const typeCondition =
      types && types.length > 0 ? inArray(profiles.type, types) : undefined;

    const orderByColumn = getOrderByColumn(orderBy);

    // TODO: assert authorization, setup a common package
    const whereConditions = [cursorCondition, typeCondition].filter(Boolean);
    const whereClause =
      whereConditions.length > 0
        ? whereConditions.length === 1
          ? whereConditions[0]
          : and(...whereConditions)
        : undefined;

    const result = await db.query.profiles.findMany({
      where: whereClause,
      with: {
        headerImage: true,
        avatarImage: true,
        organization: {
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
        },
      },
      orderBy: (_, { asc, desc }) =>
        dir === 'asc' ? asc(orderByColumn) : desc(orderByColumn),
      limit: limit + 1, // Fetch one extra to check hasMore
    });

    console.log('RESULTS', result);

    result.forEach(
      (profile) =>
        // @ts-ignore
        (profile.organization.whereWeWork =
          // @ts-ignore
          profile.organization.whereWeWork.map((item: any) => item.location)),
    );

    if (!result) {
      throw new NotFoundError('Profiles not found');
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
    console.error('Error in listProfiles:', error);
    throw error;
  }
};
