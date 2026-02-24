import { and, db, eq, inArray } from '@op/db/client';
import {
  EntityType,
  ProcessStatus,
  processInstances,
  profileUsers,
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
}) => {
  // Build process instance filter subquery (references processInstances, not profiles)
  const processInstanceConditions = [
    status?.length ? inArray(processInstances.status, status) : undefined,
    ownerProfileId
      ? eq(processInstances.ownerProfileId, ownerProfileId)
      : undefined,
    stewardProfileId
      ? eq(processInstances.stewardProfileId, stewardProfileId)
      : undefined,
  ].filter(Boolean);

  const processInstanceSubquery = db
    .select({ profileId: processInstances.profileId })
    .from(processInstances)
    .where(
      processInstanceConditions.length > 0
        ? and(...processInstanceConditions)
        : undefined,
    );

  const decodedCursor = cursor
    ? decodeCursor<{ value: string | Date; id: string }>(cursor)
    : undefined;

  // Get profiles with their process instances and the current user's roles
  const profileList = await db.query.profiles.findMany({
    where: {
      // RAW callback receives the aliased table reference so column
      // references resolve to the correct alias (e.g. d0.id not profiles.id)
      RAW: (table) => {
        const orderByColumn =
          orderBy === 'name'
            ? table.name
            : orderBy === 'createdAt'
              ? table.createdAt
              : table.updatedAt;

        const cursorCondition = decodedCursor
          ? getCursorCondition({
              column: orderByColumn,
              tieBreakerColumn: table.id,
              cursor: decodedCursor,
              direction: dir,
            })
          : undefined;

        const searchCondition = search
          ? constructTextSearch({ column: table.search, query: search })
          : undefined;

        return and(
          eq(table.type, EntityType.DECISION),
          inArray(table.id, processInstanceSubquery),
          inArray(
            table.id,
            db
              .select({ profileId: profileUsers.profileId })
              .from(profileUsers)
              .where(eq(profileUsers.authUserId, user.id)),
          ),
          cursorCondition,
          searchCondition,
        )!;
      },
    },
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
        where: { authUserId: user.id },
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
    },
    orderBy: { [orderBy]: dir },
    limit: limit + 1, // Fetch one extra to check hasMore
  });

  type DecisionProfileQueryResult = (typeof profileList)[number];

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

  // Transform profiles to include proposal/participant counts and access permissions
  const profilesWithCounts = profileList.map((profile) => {
    const { profileUsers: _, ...profileWithoutUsers } = profile;

    if (profile.processInstance) {
      const { proposals, ...instanceRest } = profile.processInstance;
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

  return { items, next: nextCursor } satisfies PaginatedResult<DecisionProfileItem>;
};
