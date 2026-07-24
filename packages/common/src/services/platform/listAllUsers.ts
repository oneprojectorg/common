import { and, count, db, ilike, inArray } from '@op/db/client';
import { authUsers, users } from '@op/db/schema';
import type { SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

import {
  type SortDir,
  decodeCursor,
  encodeCursor,
  excludeGlobalUsers,
  getGenericCursorCondition,
} from '../../utils/db';

/**
 * List every user on the platform with cursor-based pagination and optional
 * email search. Used by the platform-admin dashboard. Skips the global
 * access-control sentinel users.
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

  // Filter shared by the paginated query and the total count: exclude the
  // sentinel users and, when searching, match the email. The cursor condition
  // is added only to the paginated query.
  const baseConds = (table: { authUserId: AnyPgColumn }): SQL[] => {
    const conds: SQL[] = [excludeGlobalUsers(table.authUserId)];
    if (hasSearch) {
      // Match against auth.users.email (authoritative) via the auth_user_id FK.
      conds.push(
        inArray(
          table.authUserId,
          db
            .select({ id: authUsers.id })
            .from(authUsers)
            .where(ilike(authUsers.email, `%${query}%`)),
        ),
      );
    }
    return conds;
  };

  const [allUsers, [totalCountResult]] = await Promise.all([
    db.query.users.findMany({
      where: {
        RAW: (table) => {
          const conds = baseConds(table);
          if (decodedCursor) {
            const cursorCond = getGenericCursorCondition({
              columns: { id: table.id, date: table.createdAt },
              cursor: decodedCursor,
            });
            if (cursorCond) conds.push(cursorCond);
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
    db
      .select({ value: count() })
      .from(users)
      .where(and(...baseConds(users))),
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
