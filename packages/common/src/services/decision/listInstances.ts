import { and, asc, db, desc, eq, sql } from '@op/db/client';
import { ProcessStatus, processInstances } from '@op/db/schema';
import { logger } from '@op/logging';
import { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { PAGE_LIMIT, UnauthorizedError } from '../../utils';
import { assertProfileAccess } from '../assert';

export interface ListInstancesInput {
  ownerProfileId?: string;
  stewardProfileId?: string;
  processId?: string;
  status?: ProcessStatus;
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'name' | 'status';
  orderDirection?: 'asc' | 'desc';
  user: User;
  authUserId: string;
}

export const listInstances = async ({
  ownerProfileId,
  stewardProfileId,
  processId,
  status,
  search,
  limit = PAGE_LIMIT.md,
  offset = 0,
  orderBy = 'createdAt',
  orderDirection = 'desc',
  user,
}: ListInstancesInput) => {
  const filterProfileId = stewardProfileId ?? ownerProfileId;
  if (!filterProfileId) {
    throw new UnauthorizedError(
      'Either ownerProfileId or stewardProfileId is required',
    );
  }

  await assertProfileAccess({
    user: { id: user.id },
    profileId: filterProfileId,
    permissions: [
      { decisions: permission.ADMIN },
      { decisions: permission.READ },
    ],
  });

  try {
    // Build filter conditions
    const conditions = [];

    if (ownerProfileId) {
      conditions.push(eq(processInstances.ownerProfileId, ownerProfileId));
    }

    if (stewardProfileId) {
      conditions.push(eq(processInstances.stewardProfileId, stewardProfileId));
    }

    if (processId) {
      conditions.push(eq(processInstances.processId, processId));
    }

    if (status) {
      conditions.push(eq(processInstances.status, status));
    }

    if (search) {
      // Search using the generated search tsvector
      conditions.push(
        sql`${processInstances.search} @@ plainto_tsquery('english', ${search})`,
      );
    }

    // Combine conditions
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count for pagination
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(processInstances)
      .where(whereClause);

    const count = countResult[0]?.count || 0;

    // Get process instances with relations
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

    // Transform instances to include proposal and participant counts
    const instancesWithCounts = instanceList.map((instance) => {
      const proposalCount = instance.proposals.length || 0;
      const uniqueParticipants = new Set(
        instance.proposals.map((p) => p.submittedByProfileId),
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
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    logger.error('Error listing process instances', { error });
    throw new UnauthorizedError('Failed to list process instances');
  }
};
