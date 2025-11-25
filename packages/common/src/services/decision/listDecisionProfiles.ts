import { and, asc, db, desc, eq, inArray } from '@op/db/client';
import {
  DecisionProcess,
  EntityType,
  ObjectsInStorage,
  ProcessInstance,
  ProcessStatus,
  Profile,
  Proposal,
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

export const listDecisionProfiles = async ({
  cursor,
  user,
  search,
  status,
  limit = 10,
  orderBy = 'updatedAt',
  dir = 'desc',
}: {
  user: User;
  cursor?: string | null;
  search?: string;
  status?: ProcessStatus;
  limit?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'name';
  dir?: 'asc' | 'desc';
}) => {
  try {
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

    // Filter profiles by process instance status using a subquery
    const statusCondition = status
      ? inArray(
          profiles.id,
          db
            .select({ profileId: processInstances.profileId })
            .from(processInstances)
            .where(eq(processInstances.status, status)),
        )
      : undefined;

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
      statusCondition,
      typeCondition,
      searchCondition,
      authorizationCondition,
    ].filter(Boolean);

    const whereClause =
      whereConditions.length > 0
        ? whereConditions.length === 1
          ? whereConditions[0]
          : and(...whereConditions)
        : undefined;

    // Get profiles with their process instances
    const profileList = (await db.query.profiles.findMany({
      where: whereClause,
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
      orderBy: orderFn(profiles[orderBy]),
      limit: limit + 1, // Fetch one extra to check hasMore
    })) as Array<
      Profile & {
        headerImage: ObjectsInStorage;
        avatarImage: ObjectsInStorage;
        processInstance: ProcessInstance & {
          process: DecisionProcess;
          owner: Profile;
          proposals: Proposal[];
        };
      }
    >; // TODO: Typing due to drizzle type issues

    // Transform profiles to include proposal and participant counts in processInstance
    const profilesWithCounts = profileList.map((profile) => {
      if (profile.processInstance) {
        const instance = profile.processInstance;
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

    // Filter out profiles without processInstance
    const filteredProfiles = profilesWithCounts.filter(
      (profile) => !!profile.processInstance,
    );

    const hasMore = filteredProfiles.length > limit;
    const items = hasMore ? filteredProfiles.slice(0, limit) : filteredProfiles;
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
  } catch (error) {
    console.error('Error in listDecisionProfiles:', error);
    throw error;
  }
};
