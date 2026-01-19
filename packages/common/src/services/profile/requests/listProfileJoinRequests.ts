import { db } from '@op/db/client';
import {
  type JoinProfileRequestStatus,
  joinProfileRequests,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { and, eq } from 'drizzle-orm';

import { decodeCursor, encodeCursor, getCursorCondition } from '../../../utils';
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
  // Build cursor condition for pagination
  const cursorCondition = cursor
    ? getCursorCondition({
        column: joinProfileRequests.createdAt,
        tieBreakerColumn: joinProfileRequests.id,
        cursor: decodeCursor<ListJoinProfileRequestsCursor>(cursor),
        direction: dir,
      })
    : undefined;

  // Build where clause using SQL expressions (v2 object-style where doesn't support complex AND/OR with SQL)
  const whereClause = and(
    eq(joinProfileRequests.targetProfileId, targetProfileId),
    status ? eq(joinProfileRequests.status, status) : undefined,
    cursorCondition,
  );

  const [, results] = await Promise.all([
    assertTargetProfileAdminAccess({ user, targetProfileId }),
    db.query.joinProfileRequests.findMany({
      where: {
        RAW: whereClause,
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
