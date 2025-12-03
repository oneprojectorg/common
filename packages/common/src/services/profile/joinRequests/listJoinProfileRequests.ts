import { db } from '@op/db/client';
import {
  JoinProfileRequestStatus,
  joinProfileRequests,
  organizations,
  profiles,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';
import { and, eq } from 'drizzle-orm';

import {
  UnauthorizedError,
  decodeCursor,
  encodeCursor,
  getCursorCondition,
} from '../../../utils';
import { getOrgAccessUser, getProfileAccessUser } from '../../access';
import { JoinProfileRequestWithProfiles } from './createJoinProfileRequest';

type ListJoinProfileRequestsCursor = {
  value: string;
  id: string;
};

/**
 * Lists all join profile requests for a target profile.
 * Only admin members of the target profile (or the organization that owns the profile) can view these requests.
 */
export const listJoinProfileRequests = async ({
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
}): Promise<{
  items: JoinProfileRequestWithProfiles[];
  next: string | null;
  hasMore: boolean;
}> => {
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

  const [targetProfile, organization, profileUser, results] = await Promise.all(
    [
      db.query.profiles.findFirst({
        where: eq(profiles.id, targetProfileId),
      }),
      db.query.organizations.findFirst({
        where: eq(organizations.profileId, targetProfileId),
      }),
      getProfileAccessUser({
        user,
        profileId: targetProfileId,
      }),
      db.query.joinProfileRequests.findMany({
        where: whereClause,
        with: {
          requestProfile: true,
          targetProfile: true,
        },
        orderBy: (table, { asc, desc }) =>
          dir === 'asc' ? asc(table.createdAt) : desc(table.createdAt),
        limit: limit + 1,
      }),
    ],
  );

  // Verify target profile exists
  if (!targetProfile) {
    throw new UnauthorizedError('Target profile not found');
  }

  // Authorization: User must be an admin member of the target profile OR the organization that owns it
  if (profileUser) {
    // User is a direct member of the profile - check admin permission
    assertAccess({ profile: permission.ADMIN }, profileUser.roles);
  } else if (organization) {
    // User is not a direct member - check if they're an admin of the organization
    const orgUser = await getOrgAccessUser({
      user,
      organizationId: organization.id,
    });

    if (!orgUser) {
      throw new UnauthorizedError(
        'You must be a member of this organization to view join requests',
      );
    }

    assertAccess({ profile: permission.ADMIN }, orgUser.roles);
  } else {
    throw new UnauthorizedError(
      'You must be a member of this profile to view join requests',
    );
  }

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
    hasMore,
  };
};
