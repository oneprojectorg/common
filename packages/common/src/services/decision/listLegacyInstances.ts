import { and, asc, db, desc, eq, inArray, isNull, sql } from '@op/db/client';
import { ProcessStatus, organizations, processInstances } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { getOrgAccessUser } from '../access';

const VISIBLE_STATUSES = [
  ProcessStatus.PUBLISHED,
  ProcessStatus.COMPLETED,
  ProcessStatus.CANCELLED,
];

export const listLegacyInstances = async ({
  ownerProfileId,
  limit = 20,
  offset = 0,
  orderBy = 'createdAt',
  orderDirection = 'desc',
  user,
}: {
  ownerProfileId: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'name' | 'status';
  orderDirection?: 'asc' | 'desc';
  user: User;
  authUserId: string;
}) => {
  const org = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.profileId, ownerProfileId));

  // Check if the user has org-level decisions.READ access.
  // Non-members can still see published/completed/cancelled instances.
  let hasFullAccess = true;
  if (org[0]?.id) {
    try {
      const orgUser = await getOrgAccessUser({
        user,
        organizationId: org[0].id,
      });
      assertAccess({ decisions: permission.READ }, orgUser?.roles ?? []);
      hasFullAccess = true;
    } catch {
      // User is not a member or lacks permission — restrict to visible statuses
    }
  }

  try {
    const conditions = [eq(processInstances.ownerProfileId, ownerProfileId)];

    if (!hasFullAccess) {
      conditions.push(inArray(processInstances.status, VISIBLE_STATUSES));
    }

    const whereClause = and(...conditions);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(processInstances)
      .where(whereClause);

    const count = countResult[0]?.count || 0;

    const orderColumn = orderBy
      ? processInstances[orderBy]
      : processInstances.createdAt;

    const orderFn = orderDirection === 'asc' ? asc : desc;

    const instanceList = await db._query.processInstances.findMany({
      where: whereClause,
      with: {
        process: true,
        owner: true,
        proposals: {
          columns: {
            id: true,
            submittedByProfileId: true,
          },
        },
      },
      limit,
      offset,
      orderBy: orderFn(orderColumn),
    });

    const instancesWithCounts = instanceList.map((instance) => {
      const proposalCount = instance.proposals?.length || 0;
      const uniqueParticipants = new Set(
        instance.proposals?.map((p) => p.submittedByProfileId),
      );
      const participantCount = uniqueParticipants.size;

      return {
        ...instance,
        proposalCount,
        participantCount,
      };
    });

    return {
      instances: instancesWithCounts,
      total: Number(count),
      hasMore: offset + limit < Number(count),
    };
  } catch (error) {
    console.error('Error listing legacy process instances:', error);
    throw error;
  }
};
