import { cache } from '@op/cache';
import {
  decodeCursor,
  encodeCursor,
  getGenericCursorCondition,
} from '@op/common';
import { and, count, db, ilike } from '@op/db/client';
import { users } from '@op/db/schema';
import { TRPCError } from '@trpc/server';
import crypto from 'crypto';
import { z } from 'zod';

import { userEncoder } from '../../../encoders/';
import { withAuthenticatedPlatformAdmin } from '../../../middlewares/withAuthenticated';
import withRateLimited from '../../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../../trpcFactory';
import { dbFilter } from '../../../utils';

export const listAllUsersRouter = router({
  listAllUsers: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticatedPlatformAdmin)
    .input(
      dbFilter
        .extend({
          /** string for searching users by email (for now) */
          query: z.string().optional(),
        })
        .optional(),
    )
    .output(
      z.object({
        items: z.array(userEncoder),
        next: z.string().nullish(),
        hasMore: z.boolean(),
        total: z.number(),
      }),
    )
    .query(async ({ input }) => {
      const { limit = 10, cursor, dir = 'desc', query } = input ?? {};

      try {
        // Cursor-based pagination using updatedAt timestamp
        // Combines updatedAt with id as tiebreaker for users created at the same time
        const cursorCondition = cursor
          ? getGenericCursorCondition({
              columns: {
                id: users.id,
                date: users.updatedAt,
              },
              cursor: decodeCursor(cursor),
            })
          : undefined;

        // Build search condition if query is provided (separate from cursor for total count)
        const searchCondition =
          query && query.length >= 2
            ? ilike(users.email, `%${query}%`)
            : undefined;

        // Combine search with cursor for pagination query
        const whereCondition =
          searchCondition && cursorCondition
            ? and(cursorCondition, searchCondition)
            : searchCondition || cursorCondition;

        // Parallel database queries for optimal performance
        const [allUsers, totalCountResult] = await Promise.all([
          // Fetch users with complete profile, organization, and role data
          db.query.users.findMany({
            where: whereCondition,
            with: {
              authUser: true,
              profile: true,
              avatarImage: true,
              organizationUsers: {
                with: {
                  organization: {
                    with: {
                      profile: {
                        with: {
                          avatarImage: true,
                        },
                      },
                      whereWeWork: {
                        with: {
                          location: true,
                        },
                      },
                    },
                  },
                  roles: {
                    with: {
                      accessRole: true,
                    },
                  },
                },
              },
            },
            orderBy: (_, { asc, desc }) =>
              dir === 'asc' ? asc(users.updatedAt) : desc(users.updatedAt),
            limit: limit + 1, // Fetch one extra item to determine if more pages exist
          }),
          cache<{ value: number }>({
            type: 'user',
            params: ['search-total-' + (query ? hashSearch(query) : 'all')],
            fetch: async () => {
              const [result] = await db
                .select({ value: count() })
                .from(users)
                .where(searchCondition);
              return result;
            },
            options: {
              ttl: 1 * 60 * 1000, // 1 min
              skipMemCache: true,
            },
          }),
        ]);

        const totalCount = totalCountResult.value ?? 0;
        const hasMore = allUsers.length > limit;
        const items = hasMore ? allUsers.slice(0, limit) : allUsers;
        const lastItem = items[items.length - 1];
        const nextCursor =
          hasMore && lastItem && lastItem.updatedAt
            ? encodeCursor({
                updatedAt: new Date(lastItem.updatedAt),
                id: lastItem.id,
              })
            : null;

        // Transform whereWeWork from join table to location array for each organization
        items.forEach((user) => {
          user.organizationUsers?.forEach((orgUser) => {
            if (orgUser.organization?.whereWeWork) {
              orgUser.organization.whereWeWork =
                orgUser.organization.whereWeWork.map(
                  (item: any) => item.location,
                );
            }
          });
        });

        return {
          items: items.map((user) => userEncoder.parse(user)),
          next: nextCursor,
          hasMore,
          total: totalCount,
        };
      } catch (error: unknown) {
        throw new TRPCError({
          message: 'Failed to retrieve users',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});

/** Utility to hash search strings for cache keys */
function hashSearch(search: string) {
  return crypto.createHash('md5').update(search).digest('hex').substring(0, 16);
}
