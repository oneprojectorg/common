import { db } from '@op/db/client';
import { JoinProfileRequestStatus, joinProfileRequests } from '@op/db/schema';
import { and, eq } from 'drizzle-orm';

import { decodeCursor, encodeCursor, getCursorCondition } from '../../../utils';

/**
 * Lists all join requests for a target profile with cursor-based pagination.
 * Can optionally filter by status.
 */
export const listJoinProfileRequests = async ({
  targetProfileId,
  status,
  cursor,
  limit = 10,
  dir = 'desc',
}: {
  targetProfileId: string;
  status?: JoinProfileRequestStatus;
  cursor?: string | null;
  limit?: number;
  dir?: 'asc' | 'desc';
}) => {
  const orderByColumn = joinProfileRequests.createdAt;

  const cursorCondition = cursor
    ? getCursorCondition({
        column: orderByColumn,
        cursor: decodeCursor<{ value: string | Date }>(cursor),
        direction: dir,
      })
    : undefined;

  const whereCondition = and(
    eq(joinProfileRequests.targetProfileId, targetProfileId),
    status ? eq(joinProfileRequests.status, status) : undefined,
    cursorCondition,
  );

  const result = await db.query.joinProfileRequests.findMany({
    where: whereCondition,
    with: {
      requestProfile: {
        with: {
          avatarImage: true,
        },
      },
    },
    orderBy: (_, { asc, desc }) =>
      dir === 'asc' ? asc(orderByColumn) : desc(orderByColumn),
    limit: limit + 1,
  });

  const hasMore = result.length > limit;
  const items = hasMore ? result.slice(0, limit) : result;
  const lastItem = items[items.length - 1];

  const cursorValue = lastItem?.createdAt ? new Date(lastItem.createdAt) : null;

  const nextCursor =
    hasMore && lastItem && cursorValue
      ? encodeCursor<{ value: Date }>({ value: cursorValue })
      : null;

  return { items, next: nextCursor, hasMore };
};
