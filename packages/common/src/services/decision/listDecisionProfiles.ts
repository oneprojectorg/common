import { and, asc, db, desc, eq, inArray } from '@op/db/client';
import {
  EntityType,
  ProcessStatus,
  processInstances,
  profileUsers,
  profiles,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { collapseRoles } from 'access-zones';

import {
  type PaginatedResult,
  constructTextSearch,
  decodeCursor,
  encodeCursor,
  getCursorCondition,
} from '../../utils';
import { getNormalizedRoles } from '../access';
import {
  type DecisionRolePermissions,
  fromDecisionBitField,
} from './permissions';

const decisionProfileWith = {
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
      steward: {
        with: {
          avatarImage: true,
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
  profileUsers: {
    with: {
      roles: {
        with: {
          accessRole: {
            with: {
              zonePermissions: {
                with: { accessZone: true },
              },
            },
          },
        },
      },
    },
  },
} as const;

type DecisionProfileQueryResult = Awaited<
  ReturnType<
    typeof db._query.profiles.findMany<{ with: typeof decisionProfileWith }>
  >
>[number];

type DecisionProfileItem = Omit<
  DecisionProfileQueryResult,
  'processInstance' | 'profileUsers'
> & {
  processInstance: NonNullable<
    DecisionProfileQueryResult['processInstance']
  > & {
    proposalCount: number;
    participantCount: number;
    access: DecisionRolePermissions;
  };
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
  stewardProfileId,
}: {
  user: User;
  search?: string;
  status?: ProcessStatus[];
  limit?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'name';
  dir?: 'asc' | 'desc';
  cursor?: string | null;
  ownerProfileId?: string | null;
  stewardProfileId?: string | null;
}): Promise<PaginatedResult<DecisionProfileItem>> => {
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
  const processInstanceConditions = [
    status?.length ? inArray(processInstances.status, status) : undefined,
    ownerProfileId
      ? eq(processInstances.ownerProfileId, ownerProfileId)
      : undefined,
    stewardProfileId
      ? eq(processInstances.stewardProfileId, stewardProfileId)
      : undefined,
  ].filter(Boolean);

  const processInstanceQuery = inArray(
    profiles.id,
    db
      .select({ profileId: processInstances.profileId })
      .from(processInstances)
      .where(
        processInstanceConditions.length > 0
          ? and(...processInstanceConditions)
          : undefined,
      ),
  );

  // Build search condition if provided (search on profile name/bio)
  const searchCondition = search
    ? constructTextSearch({ column: profiles.search, query: search })
    : undefined;

  // Filter profiles to only those the user has access to via profileUsers
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
    processInstanceQuery,
    typeCondition,
    searchCondition,
    authorizationCondition,
  ].filter(Boolean);

  const whereClause =
    whereConditions.length > 0 ? and(...whereConditions) : undefined;

  // Get profiles with their process instances and the current user's roles
  const profileList = await db._query.profiles.findMany({
    where: whereClause,
    with: {
      ...decisionProfileWith,
      profileUsers: {
        ...decisionProfileWith.profileUsers,
        where: (table, { eq }) => eq(table.authUserId, user.id),
      },
    },
    orderBy: orderFn(profiles[orderBy]),
    limit: limit + 1, // Fetch one extra to check hasMore
  });

  // Transform profiles to include proposal/participant counts and access permissions
  const profilesWithCounts = (profileList as DecisionProfileQueryResult[]).map(
    (profile) => {
      const { profileUsers: _, ...profileWithoutUsers } = profile;

      if (profile.processInstance) {
        const instance = profile.processInstance as NonNullable<
          DecisionProfileQueryResult['processInstance']
        > & {
          proposals: { id: string; submittedByProfileId: string | null }[];
        };
        const { proposals, ...instanceRest } = instance;
        const proposalCount = proposals?.length ?? 0;
        const uniqueParticipants = new Set(
          proposals?.map((proposal) => proposal.submittedByProfileId),
        );
        const participantCount = uniqueParticipants.size;

        // Compute decision access from the joined profileUser roles
        const profileUser = profile.profileUsers?.[0];
        const roles = profileUser
          ? getNormalizedRoles(profileUser.roles)
          : [];
        const collapsed = collapseRoles(roles);
        const access = fromDecisionBitField(collapsed.decisions ?? 0);

        return {
          ...profileWithoutUsers,
          processInstance: {
            ...instanceRest,
            proposals,
            proposalCount,
            participantCount,
            access,
          },
        };
      }

      return profileWithoutUsers;
    },
  );

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

  return { items, next: nextCursor };
};
