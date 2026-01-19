import { db } from '@op/db/client';
import {
  type JoinProfileRequestStatus,
  joinProfileRequests,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';

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

  const [, results] = await Promise.all([
    assertTargetProfileAdminAccess({ user, targetProfileId }),
    db._query.joinProfileRequests.findMany({
      where: (table, { and, eq }) =>
        and(
          eq(table.targetProfileId, targetProfileId),
          status ? eq(table.status, status) : undefined,
          cursorCondition,
        ),
      with: {
        requestProfile: true,
        targetProfile: true,
      },
      orderBy: (_, { asc, desc }) =>
        dir === 'asc'
          ? asc(joinProfileRequests.createdAt)
          : desc(joinProfileRequests.createdAt),
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
