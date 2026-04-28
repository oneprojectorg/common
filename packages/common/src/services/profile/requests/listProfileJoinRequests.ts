import { db } from '@op/db/client';
import { JoinProfileRequestStatus } from '@op/db/schema';
import { User } from '@op/supabase/lib';

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
          RAW: (table) =>
            getCursorCondition({
              column: table.createdAt,
              tieBreakerColumn: table.id,
              cursor: decodedCursor,
              direction: dir,
            })!,
        }),
      },
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
