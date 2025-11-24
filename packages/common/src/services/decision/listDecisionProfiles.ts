import { and, asc, db, desc, eq } from '@op/db/client';
import {
  EntityType,
  ProcessInstance,
  ProcessStatus,
  Proposal,
  profiles,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';

import {
  NotFoundError,
  UnauthorizedError,
  constructTextSearch,
  decodeCursor,
  encodeCursor,
  getGenericCursorCondition,
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
  if (!user) {
    throw new UnauthorizedError();
  }

  try {
    const cursorCondition = cursor
      ? getGenericCursorCondition({
          columns: {
            id: profiles.id,
            date: profiles.updatedAt,
          },
          cursor: decodeCursor(cursor),
        })
      : undefined;

    const typeCondition = eq(profiles.type, EntityType.DECISION);

    // Build search condition if provided (search on profile name/bio)
    const searchCondition = search
      ? constructTextSearch({ column: profiles.search, query: search })
      : undefined;

    const orderFn = dir === 'asc' ? asc : desc;

    // TODO: assert authorization
    const whereConditions = [
      cursorCondition,
      typeCondition,
      searchCondition,
    ].filter(Boolean);
    const whereClause =
      whereConditions.length > 0
        ? whereConditions.length === 1
          ? whereConditions[0]
          : and(...whereConditions)
        : undefined;

    // Get profiles with their process instances
    const profileList = await db.query.profiles.findMany({
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
    });

    // Transform profiles to include proposal and participant counts in processInstance
    const profilesWithCounts = profileList.map((profile) => {
      if (profile.processInstance) {
        const instance = profile.processInstance as ProcessInstance & {
          proposals: Proposal[];
        };
        const proposalCount = instance.proposals?.length || 0;
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

    // Filter out profiles without processInstance and optionally by status
    const filteredProfiles = profilesWithCounts.filter((profile) => {
      if (!profile.processInstance) {
        return false;
      }
      const instance = profile.processInstance as ProcessInstance;
      if (status && instance.status !== status) {
        return false;
      }
      return true;
    });

    if (!filteredProfiles) {
      throw new NotFoundError('Decision profiles not found');
    }

    const hasMore = filteredProfiles.length > limit;
    const items = hasMore ? filteredProfiles.slice(0, limit) : filteredProfiles;
    const lastItem = items[items.length - 1];
    const nextCursor =
      hasMore && lastItem && lastItem.updatedAt
        ? encodeCursor({
            date: new Date(lastItem.updatedAt),
            id: lastItem.id,
          })
        : null;

    return { items, next: nextCursor, hasMore };
  } catch (error) {
    console.error('Error in listDecisionProfiles:', error);
    throw error;
  }
};
