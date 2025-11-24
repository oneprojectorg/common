import { and, db, inArray, sql } from '@op/db/client';
import { type EntityType, locations, profiles } from '@op/db/schema';
import { User } from '@op/supabase/lib';

import {
  NotFoundError,
  UnauthorizedError,
  decodeCursor,
  encodeCursor,
  getGenericCursorCondition,
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
    // Build cursor condition for pagination
    const cursorCondition = cursor
      ? getGenericCursorCondition({
          columns: {
            id: profiles.id,
            date: profiles.updatedAt,
          },
          cursor: decodeCursor(cursor),
        })
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
    const items = hasMore ? result.slice(0, limit) : result;
    const lastItem = items[items.length - 1];
    const nextCursor =
      hasMore && lastItem && lastItem.updatedAt
        ? encodeCursor({
            updatedAt: new Date(lastItem.updatedAt),
            id: lastItem.id,
          })
        : null;

    return { items, next: nextCursor, hasMore };
  } catch (error) {
    console.error('Error in listProfiles:', error);
    throw error;
  }
};
