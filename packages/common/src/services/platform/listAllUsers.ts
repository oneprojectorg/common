import { GLOBAL_USER_IDS } from '@op/core';
import { and, count, db, ilike, notInArray } from '@op/db/client';
import { users } from '@op/db/schema';
import type { SQL } from 'drizzle-orm';

import {
  type SortDir,
  decodeCursor,
  encodeCursor,
  getGenericCursorCondition,
} from '../../utils/db';

/**
 * List every user on the platform with cursor-based pagination and optional
 * email search. Used by the platform-admin dashboard.
 *
 * The access-control sentinel users (GLOBAL_USER_PUBLIC / GLOBAL_USER_ANONYMOUS)
 * are always excluded from both the items and the total. Their UUIDs are the
 * auth.users ids, which map to public.users.authUserId — not the autoId()
 * primary key.
 */
export const listAllUsers = async ({
  cursor,
  dir = 'desc',
  query,
  limit,
}: {
  cursor?: string | null;
  dir?: SortDir;
  query?: string;
  limit?: number;
}) => {
  const decodedCursor = cursor ? decodeCursor(cursor) : undefined;
  const hasSearch = !!(query && query.length >= 2);
  const sentinelIds = [...GLOBAL_USER_IDS];

  // Used by the count() select below; references the raw schema table.
  const searchCondition = hasSearch
    ? and(
        notInArray(users.authUserId, sentinelIds),
        ilike(users.email, `%${query}%`),
      )
    : notInArray(users.authUserId, sentinelIds);

  // Uses V2 `db.query` (single SQL via LATERAL joins) instead of V1 `db._query`
  // to avoid fan-out that saturates the Supavisor transaction-mode pool.
  // The RAW callback receives the aliased table used inside V2's generated
  // SQL — conditions must be built against that alias, not the schema ref.
  const [allUsers, [totalCountResult]] = await Promise.all([
    db.query.users.findMany({
      where: {
        RAW: (table) => {
          const conds: SQL[] = [notInArray(table.authUserId, sentinelIds)];
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
      },
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
  const next =
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
        orgUser.organization.whereWeWork = orgUser.organization.whereWeWork.map(
          (item: any) => item.location,
        );
      }
    });
  });

  return { items, next, total: totalCount };
};
