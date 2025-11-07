import { cache } from '@op/cache';
import { decodeCursor, encodeCursor } from '@op/common';
import { and, count, db, eq, lt, or } from '@op/db/client';
import { users } from '@op/db/schema';
import { TRPCError } from '@trpc/server';
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
    .input(dbFilter.optional())
    .output(
      z.object({
        items: z.array(userEncoder),
        next: z.string().nullish(),
        hasMore: z.boolean(),
        total: z.number(),
      }),
    )
    .query(async ({ input }) => {
      const { limit = 10, cursor, dir = 'desc' } = input ?? {};

      try {
        // Cursor-based pagination using updatedAt timestamp
        // Combines updatedAt with id as tiebreaker for users created at the same time
        const cursorData = cursor ? decodeCursor(cursor) : null;
        const cursorCondition = cursorData
          ? or(
              lt(users.updatedAt, cursorData.updatedAt),
              and(
                eq(users.updatedAt, cursorData.updatedAt),
                lt(users.id, cursorData.id),
              ),
            )
          : undefined;

        // Parallel database queries for optimal performance
        const [allUsers, totalCountResult] = await Promise.all([
          // Fetch users with complete profile, organization, and role data
          db.query.users.findMany({
            where: cursorCondition,
            with: {
              profile: true,
              organizationUsers: {
                with: {
                  organization: {
                    with: {
                      profile: true,
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
          // Total user count with 5-minute cache to reduce database load
          cache<{ value: number }>({
            type: 'user',
            params: ['total-count'],
            fetch: async () => {
              const [result] = await db.select({ value: count() }).from(users);
              return result;
            },
            options: {
              ttl: 5 * 60 * 1000, // 5 minutes
            },
          }),
        ]);

        const totalCount = totalCountResult.value ?? 0;
        const hasMore = allUsers.length > limit;
        const items = hasMore ? allUsers.slice(0, limit) : allUsers;
        const lastItem = items[items.length - 1];
        const nextCursor =
          hasMore && lastItem && lastItem.updatedAt
            ? encodeCursor(new Date(lastItem.updatedAt), lastItem.id)
            : null;

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
