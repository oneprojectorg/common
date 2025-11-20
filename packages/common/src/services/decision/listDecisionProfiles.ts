import { and, asc, db, desc, eq, lt, or, sql } from '@op/db/client';
import { EntityType, profiles } from '@op/db/schema';
import { User } from '@op/supabase/lib';

import {
  NotFoundError,
  UnauthorizedError,
  decodeCursor,
  encodeCursor,
} from '../../utils';

const getOrderByColumn = (orderBy: string) => {
  switch (orderBy) {
    case 'updatedAt':
      return profiles.updatedAt;
    case 'createdAt':
      return profiles.createdAt;
    case 'name':
      return profiles.name;
    default:
      return profiles.updatedAt;
  }
};

export const listDecisionProfiles = async ({
  cursor,
  user,
  limit = 10,
  orderBy = 'updatedAt',
  dir = 'desc',
  search,
  status,
}: {
  user: User;
  cursor?: string | null;
  limit?: number;
  orderBy?: string;
  dir?: 'asc' | 'desc';
  search?: string;
  status?: 'draft' | 'published' | 'completed' | 'cancelled';
}) => {
  if (!user) {
    throw new UnauthorizedError();
  }

  try {
    const cursorData = cursor ? decodeCursor(cursor) : null;

    // Build cursor condition for pagination
    const cursorCondition = cursorData
      ? or(
          lt(profiles.updatedAt, cursorData.updatedAt),
          and(
            eq(profiles.updatedAt, cursorData.updatedAt),
            lt(profiles.id, cursorData.id),
          ),
        )
      : undefined;

    // Filter by DECISION type
    const typeCondition = eq(profiles.type, EntityType.DECISION);

    // Build search condition if provided (search on profile name/bio)
    const searchCondition = search
      ? sql`${profiles.search} @@ plainto_tsquery('english', ${search})`
      : undefined;

    const orderByColumn = getOrderByColumn(orderBy);
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
      orderBy: orderFn(orderByColumn),
      limit: limit + 1, // Fetch one extra to check hasMore
    });

    // Transform profiles to include proposal and participant counts in processInstance
    const profilesWithCounts = profileList.map((profile) => {
      if (profile.processInstance) {
        const instance = profile.processInstance as any;
        const proposalCount = instance.proposals?.length || 0;
        const uniqueParticipants = new Set(
          instance.proposals?.map((p: any) => p.submittedByProfileId),
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
      const instance = profile.processInstance as any;
      if (status && instance.status !== status) {
        return false;
      }
      return true;
    });

    if (!filteredProfiles) {
      throw new NotFoundError('Decision profiles not found');
    }

    const hasMore = filteredProfiles.length > limit;
    const items = hasMore
      ? filteredProfiles.slice(0, limit)
      : filteredProfiles;
    const lastItem = items[items.length - 1];
    const nextCursor =
      hasMore && lastItem && lastItem.updatedAt
        ? encodeCursor(new Date(lastItem.updatedAt), lastItem.id)
        : null;

    return { items, next: nextCursor, hasMore };
  } catch (error) {
    console.error('Error in listDecisionProfiles:', error);
    throw error;
  }
};
