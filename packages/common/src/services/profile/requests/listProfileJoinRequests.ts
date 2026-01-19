import { db } from '@op/db/client';
import type { JoinProfileRequestStatus } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { and, eq, gt, lt, or } from 'drizzle-orm';

import { decodeCursor, encodeCursor } from '../../../utils';
import { assertTargetProfileAdminAccess } from './assertTargetProfileAdminAccess';

type ListJoinProfileRequestsCursor = {
  value: string;
  id: string;
};

/**
 * Lists all join profile requests for a target profile.
 * Only admin members of the target organization can view these requests.
 */
export const listProfileJoinRequests = async ({
  user,
  targetProfileId,
  status,
  cursor,
  limit = 10,
  dir = 'desc',
}: {
  user: User;
  targetProfileId: string;
  status?: JoinProfileRequestStatus;
  cursor?: string | null;
  limit?: number;
  dir?: 'asc' | 'desc';
}) => {
  const decodedCursor = cursor
    ? decodeCursor<ListJoinProfileRequestsCursor>(cursor)
    : undefined;

  const [, results] = await Promise.all([
    assertTargetProfileAdminAccess({ user, targetProfileId }),
    db.query.joinProfileRequests.findMany({
      where: {
        targetProfileId,
        ...(status && { status }),
        ...(decodedCursor && {
          RAW: (table) => {
            const compareFn = dir === 'asc' ? gt : lt;
            return or(
              compareFn(table.createdAt, decodedCursor.value),
              and(
                eq(table.createdAt, decodedCursor.value),
                compareFn(table.id, decodedCursor.id),
              ),
            ) as ReturnType<typeof or> & {};
          },
        }),
      },
      with: {
        requestProfile: true,
        targetProfile: true,
      },
      orderBy: {
        createdAt: dir,
      },
      limit: limit + 1,
    }),
  ]);

  const hasMore = results.length > limit;
  const items = hasMore ? results.slice(0, limit) : results;
  const lastItem = items[items.length - 1];

  const nextCursor =
    hasMore && lastItem?.createdAt
      ? encodeCursor<ListJoinProfileRequestsCursor>({
          value: lastItem.createdAt,
          id: lastItem.id,
        })
      : null;

  return {
    items,
    next: nextCursor,
    hasMore,
  };
};
