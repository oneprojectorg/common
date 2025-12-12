import { and, asc, db, desc, eq, inArray } from '@op/db/client';
import {
  EntityType,
  ProcessStatus,
  processInstances,
  profileUsers,
  profiles,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';

import {
  constructTextSearch,
  decodeCursor,
  encodeCursor,
  getCursorCondition,
} from '../../utils';

// Query configuration for fetching decision profiles with relations
const decisionProfileQueryConfig = {
  with: {
    headerImage: true,
    avatarImage: true,
    processInstance: {
      with: {
        process: true,
        owner: {
          with: {
            avatarImage: true,
            organization: true,
          },
        },
        proposals: {
          columns: {
            id: true,
            submittedByProfileId: true,
          },
        },
      },
    },
  },
} as const;

type DecisionProfileQueryResult = Awaited<
  ReturnType<
    typeof db.query.profiles.findMany<typeof decisionProfileQueryConfig>
  >
>[number];

type DecisionProfileItem = Omit<
  DecisionProfileQueryResult,
  'processInstance'
> & {
  processInstance: NonNullable<
    DecisionProfileQueryResult['processInstance']
  > & {
    proposalCount: number;
    participantCount: number;
  };
};

type ListDecisionProfilesResult = {
  items: DecisionProfileItem[];
  next: string | null;
  hasMore: boolean;
};

export const listDecisionProfiles = async ({
  user,
  search,
  status,
  limit = 10,
  orderBy = 'updatedAt',
  dir = 'desc',
  cursor,
  ownerProfileId,
}: {
  user: User;
  search?: string;
  status?: ProcessStatus;
  limit?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'name';
  dir?: 'asc' | 'desc';
  cursor?: string | null;
  ownerProfileId?: string | null;
}): Promise<ListDecisionProfilesResult> => {
  // Get the column to order by
  const orderByColumn =
    orderBy === 'name'
      ? profiles.name
      : orderBy === 'createdAt'
        ? profiles.createdAt
        : profiles.updatedAt;

  const cursorCondition = cursor
    ? getCursorCondition({
        column: orderByColumn,
        tieBreakerColumn: profiles.id,
        cursor: decodeCursor<{ value: string | Date; id: string }>(cursor),
        direction: dir,
      })
    : undefined;

  const typeCondition = eq(profiles.type, EntityType.DECISION);

  // Build process instance filter conditions
  const processInstanceFilters = [
    status ? eq(processInstances.status, status) : undefined,
    ownerProfileId
      ? eq(processInstances.ownerProfileId, ownerProfileId)
      : undefined,
  ].filter(Boolean);

  const processInstanceCondition = inArray(
    profiles.id,
    db
      .select({ profileId: processInstances.profileId })
      .from(processInstances)
      .where(
        processInstanceFilters.length > 0
          ? and(...processInstanceFilters)
          : undefined, // This will still work correctly
      ),
  );

  // Build search condition if provided (search on profile name/bio)
  const searchCondition = search
    ? constructTextSearch({ column: profiles.search, query: search })
    : undefined;

  // Filter profiles to only those the user has access to via profileUsers
  // This uses a subquery which executes as a single query at the database level
  const authorizationCondition = inArray(
    profiles.id,
    db
      .select({ profileId: profileUsers.profileId })
      .from(profileUsers)
      .where(eq(profileUsers.authUserId, user.id)),
  );

  const orderFn = dir === 'asc' ? asc : desc;

  const whereConditions = [
    cursorCondition,
    processInstanceCondition,
    typeCondition,
    searchCondition,
    authorizationCondition,
  ].filter(Boolean);

  const whereClause =
    whereConditions.length > 0 ? and(...whereConditions) : undefined;

  // Get profiles with their process instances
  const profileList = await db.query.profiles.findMany({
    where: whereClause,
    ...decisionProfileQueryConfig,
    orderBy: orderFn(profiles[orderBy]),
    limit: limit + 1, // Fetch one extra to check hasMore
  });

  // Transform profiles to include proposal and participant counts in processInstance
  const profilesWithCounts = profileList.map((profile) => {
    if (profile.processInstance) {
      const instance = profile.processInstance as {
        proposals: { id: string; submittedByProfileId: string | null }[];
        [key: string]: unknown;
      };
      const proposalCount = instance.proposals?.length ?? 0;
      const uniqueParticipants = new Set(
        instance.proposals?.map((proposal) => proposal.submittedByProfileId),
      );
      const participantCount = uniqueParticipants.size;

      return {
        ...profile,
        processInstance: {
          ...instance,
          proposalCount,
          participantCount,
        },
      };
    }
    return profile;
  });

  const hasMore = profilesWithCounts.length > limit;
  const items = (
    hasMore ? profilesWithCounts.slice(0, limit) : profilesWithCounts
  ) as DecisionProfileItem[];
  const lastItem = items[items.length - 1];

  // Get the cursor value based on the orderBy column
  const getCursorValue = () => {
    if (!lastItem) {
      return null;
    }
    if (orderBy === 'name') {
      return lastItem.name;
    }
    if (orderBy === 'createdAt') {
      return lastItem.createdAt ? new Date(lastItem.createdAt) : null;
    }
    return lastItem.updatedAt ? new Date(lastItem.updatedAt) : null;
  };

  const cursorValue = getCursorValue();
  const nextCursor =
    hasMore && lastItem && cursorValue
      ? encodeCursor<{ value: string | Date; id: string }>({
          value: cursorValue,
          id: lastItem.id,
        })
      : null;

  return { items, next: nextCursor, hasMore };
};
