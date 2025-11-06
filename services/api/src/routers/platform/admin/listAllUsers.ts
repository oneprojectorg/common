import { assertPlatformAdmin, decodeCursor, encodeCursor } from '@op/common';
import { and, count, db, eq, lt, or } from '@op/db/client';
import { users } from '@op/db/schema';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { userEncoder } from '../../../encoders/';
import withAuthenticated from '../../../middlewares/withAuthenticated';
import withRateLimited from '../../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../../trpcFactory';
import { dbFilter } from '../../../utils';

export const listAllUsersRouter = router({
  listAllUsers: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .input(dbFilter.optional())
    .output(
      z.object({
        items: z.array(userEncoder),
        next: z.string().nullish(),
        hasMore: z.boolean(),
        total: z.number(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const { limit = 10, cursor, dir = 'desc' } = input ?? {};

      try {
        await assertPlatformAdmin(user.id);

        // cursor createdAt pagination logic
        const cursorData = cursor ? decodeCursor(cursor) : null;
        const cursorCondition = cursorData
          ? or(
              lt(users.createdAt, cursorData.createdAt),
              and(
                eq(users.createdAt, cursorData.createdAt),
                lt(users.id, cursorData.id),
              ),
            )
          : undefined;

        // db queries
        const [allUsers, [totalCountResult]] = await Promise.all([
          // all users with pagination
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
              dir === 'asc' ? asc(users.createdAt) : desc(users.createdAt),
            limit: limit + 1, // Fetch one extra to check hasMore
          }),
          // total count
          db.select({ value: count() }).from(users),
        ]);

        const totalCount = totalCountResult?.value ?? 0;
        const hasMore = allUsers.length > limit;
        const items = hasMore ? allUsers.slice(0, limit) : allUsers;
        const lastItem = items[items.length - 1];
        const nextCursor =
          hasMore && lastItem && lastItem.createdAt
            ? encodeCursor(new Date(lastItem.createdAt), lastItem.id)
            : null;

        return {
          items: items.map((user) => userEncoder.parse(user)),
          next: nextCursor,
          hasMore,
          total: totalCount,
        };
      } catch (error: unknown) {
        if (error instanceof Error) {
          if (
            error.message.includes('Platform admin') ||
            error.message.includes('Unauthorized')
          ) {
            throw new TRPCError({
              message: 'Platform admin access required',
              code: 'UNAUTHORIZED',
            });
          }
        }

        throw new TRPCError({
          message: 'Failed to retrieve users',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});
