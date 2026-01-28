import { db } from '@op/db/client';
import { JoinProfileRequestStatus, joinProfileRequests } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { and, eq } from 'drizzle-orm';

import {
  type PaginatedResult,
  decodeCursor,
  encodeCursor,
  getCursorCondition,
} from '../../../utils';
import { assertTargetProfileAdminAccess } from './assertTargetProfileAdminAccess';
import { JoinProfileRequestWithProfiles } from './types';

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
}): Promise<PaginatedResult<JoinProfileRequestWithProfiles>> => {
  // Build cursor condition for pagination
  const cursorCondition = cursor
    ? getCursorCondition({
        column: joinProfileRequests.createdAt,
        tieBreakerColumn: joinProfileRequests.id,
        cursor: decodeCursor<ListJoinProfileRequestsCursor>(cursor),
        direction: dir,
      })
    : undefined;

  // Build where clause
  const whereClause = and(
    eq(joinProfileRequests.targetProfileId, targetProfileId),
    status ? eq(joinProfileRequests.status, status) : undefined,
    cursorCondition,
  );

  const [, results] = await Promise.all([
    assertTargetProfileAdminAccess({ user, targetProfileId }),
    db._query.joinProfileRequests.findMany({
      where: whereClause,
      with: {
        requestProfile: true,
        targetProfile: true,
      },
      orderBy: (table, { asc, desc }) =>
        dir === 'asc' ? asc(table.createdAt) : desc(table.createdAt),
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
    // Type assertion needed because Drizzle's relational queries infer relations as
    // { [x: string]: any } | { [x: string]: any }[] instead of the actual Profile type.
    // This is a known Drizzle ORM limitation (see github.com/drizzle-team/drizzle-orm/issues/695)
    // TODO: Re-check if this is still needed after upgrading to Drizzle v1
    items: items as JoinProfileRequestWithProfiles[],
    next: nextCursor,
  };
};
