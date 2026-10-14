import { match } from '@op/core';
import { and, db, eq, inArray, ne, sql } from '@op/db/client';
import {
  EntityType,
  locations,
  organizations,
  organizationsStrategies,
  organizationsTerms,
  profiles,
} from '@op/db/schema';
import { logger } from '@op/logging';

import {
  PAGE_LIMIT,
  NotFoundError,
  decodeCursor,
  encodeCursor,
  getCursorCondition,
} from '../../utils';

export const listProfiles = async ({
  cursor,
  limit = PAGE_LIMIT.sm,
  orderBy = 'updatedAt',
  dir = 'desc',
  types,
  focusAreaIds,
  strategyIds,
}: {
  cursor?: string | null;
  limit?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'name';
  dir?: 'asc' | 'desc';
  types?: EntityType[];
  /** Organizations tagged with any of these focus-area taxonomy terms. */
  focusAreaIds?: string[];
  /** Organizations tagged with any of these strategy taxonomy terms. */
  strategyIds?: string[];
}) => {
  try {
    const orderByColumn = match(orderBy, {
      name: profiles.name,
      createdAt: profiles.createdAt,
      _: profiles.updatedAt,
    });

    // `id` breaks ties for every ordering, in both ORDER BY and the cursor:
    // equal names or timestamps otherwise repeat or skip rows across pages.
    const cursorCondition = cursor
      ? getCursorCondition({
          column: orderByColumn,
          tieBreakerColumn: profiles.id,
          cursor: decodeCursor<{ value: string | Date; id?: string }>(cursor),
          direction: dir,
        })
      : undefined;

    // Build type filter condition
    const typeCondition =
      types && types.length > 0 ? inArray(profiles.type, types) : undefined;

    // Term filters match an organization's profile. Each is "any of these
    // terms"; together they must both hold.
    const focusAreaCondition = focusAreaIds?.length
      ? inArray(
          profiles.id,
          db
            .select({ profileId: organizations.profileId })
            .from(organizations)
            .innerJoin(
              organizationsTerms,
              eq(organizationsTerms.organizationId, organizations.id),
            )
            .where(inArray(organizationsTerms.taxonomyTermId, focusAreaIds)),
        )
      : undefined;
    const strategyCondition = strategyIds?.length
      ? inArray(
          profiles.id,
          db
            .select({ profileId: organizations.profileId })
            .from(organizations)
            .innerJoin(
              organizationsStrategies,
              eq(organizationsStrategies.organizationId, organizations.id),
            )
            .where(
              inArray(organizationsStrategies.taxonomyTermId, strategyIds),
            ),
        )
      : undefined;

    // Listing has no access check, so phase names would leak across decisions.
    const whereClause = and(
      cursorCondition,
      typeCondition,
      focusAreaCondition,
      strategyCondition,
      ne(profiles.type, EntityType.PHASE),
    );

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
        dir === 'asc'
          ? [asc(orderByColumn), asc(profiles.id)]
          : [desc(orderByColumn), desc(profiles.id)],
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
      throw new NotFoundError('Profiles');
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
            id: lastItem.id,
          })
        : null;

    return { items, next: nextCursor };
  } catch (error) {
    logger.error('Error in listProfiles', { error });
    throw error;
  }
};
