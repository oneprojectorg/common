import {
  decodeCursor,
  encodeCursor,
  getGenericCursorCondition,
} from '@op/common';
import { and, count, db, ilike } from '@op/db/client';
import { users } from '@op/db/schema';
import type { SQL } from 'drizzle-orm';
import { z } from 'zod';

import { userEncoder } from '../../../encoders/';
import { withAuthenticatedPlatformAdmin } from '../../../middlewares/withAuthenticatedPlatformAdmin';
import withRateLimited from '../../../middlewares/withRateLimited';
import { commonProcedure, router } from '../../../trpcFactory';
import { dbFilter } from '../../../utils';

export const listAllUsersRouter = router({
  listAllUsers: commonProcedure
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
        total: z.number(),
      }),
    )
    .query(async ({ input }) => {
      const { cursor, dir = 'desc', query, limit } = input ?? {};
      const decodedCursor = cursor ? decodeCursor(cursor) : undefined;
      const hasSearch = !!(query && query.length >= 2);

      // Used by the count() select below; references the raw schema table.
      const searchCondition = hasSearch
        ? ilike(users.email, `%${query}%`)
        : undefined;

      const hasWhere = !!decodedCursor || hasSearch;

      // Uses V2 `db.query` (single SQL via LATERAL joins) instead of V1 `db._query`
      // to avoid fan-out that saturates the Supavisor transaction-mode pool.
      // The RAW callback receives the aliased table used inside V2's generated
      // SQL — conditions must be built against that alias, not the schema ref.
      const [allUsers, [totalCountResult]] = await Promise.all([
        db.query.users.findMany({
          where: hasWhere
            ? {
                RAW: (table) => {
                  const conds: SQL[] = [];
                  if (decodedCursor) {
                    const cursorCond = getGenericCursorCondition({
                      columns: { id: table.id, date: table.createdAt },
                      cursor: decodedCursor,
                    });
                    if (cursorCond) conds.push(cursorCond);
                  }
                  if (hasSearch) {
                    conds.push(ilike(table.email, `%${query}%`));
                  }
                  return conds.length > 1 ? and(...conds)! : conds[0]!;
                },
              }
            : undefined,
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
          orderBy: { createdAt: dir },
          ...(limit !== undefined && { limit: limit + 1 }),
        }),
        db.select({ value: count() }).from(users).where(searchCondition),
      ]);

      const totalCount = totalCountResult?.value ?? 0;
      const hasMore = limit !== undefined && allUsers.length > limit;
      const items = hasMore ? allUsers.slice(0, limit) : allUsers;
      const lastItem = items[items.length - 1];
      const nextCursor =
        hasMore && lastItem && lastItem.createdAt
          ? encodeCursor({
              date: new Date(lastItem.createdAt),
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
        total: totalCount,
      };
    }),
});
