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
      const {
        limit = 10,
        cursor,
        orderBy = 'createdAt',
        dir = 'desc',
      } = input ?? {};

      try {
        await assertPlatformAdmin(user.id);

        const cursorData = cursor ? decodeCursor(cursor) : null;

        // Build cursor condition
        const cursorCondition = cursorData
          ? or(
              lt(users.createdAt, cursorData.updatedAt),
              and(
                eq(users.createdAt, cursorData.updatedAt),
                lt(users.id, cursorData.id),
              ),
            )
          : undefined;

        // Determine order by column
        const orderByColumn =
          orderBy === 'updatedAt' ? users.updatedAt : users.createdAt;

        // Get total count of users
        const totalCountResult = await db
          .select({ value: count() })
          .from(users);
        const totalCount = totalCountResult[0]?.value ?? 0;

        const allUsers = await db.query.users.findMany({
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
            dir === 'asc' ? asc(orderByColumn) : desc(orderByColumn),
          limit: limit + 1, // Fetch one extra to check hasMore
        });

        console.log('all users', allUsers);

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
        console.error('Error listing all users:', error);

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
