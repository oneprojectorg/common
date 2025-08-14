import { and, asc, db, desc, eq, sql } from '@op/db/client';
import { processInstances } from '@op/db/schema';
import { User } from '@op/supabase/lib';

import { UnauthorizedError } from '../../utils';

export interface ListInstancesInput {
  ownerProfileId?: string;
  processId?: string;
  status?: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'name' | 'status';
  orderDirection?: 'asc' | 'desc';
  user: User;
}

export const listInstances = async ({
  ownerProfileId,
  processId,
  status,
  search,
  limit = 20,
  offset = 0,
  orderBy = 'createdAt',
  orderDirection = 'desc',
  user,
}: ListInstancesInput) => {
  if (!user) {
    throw new UnauthorizedError('User must be authenticated');
  }

  // TODO: ASSERT VIEW ACCESS ON ORGUSER

  try {
    // Build filter conditions
    const conditions = [];

    if (ownerProfileId) {
      conditions.push(eq(processInstances.ownerProfileId, ownerProfileId));
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

    const instanceList = await db.query.processInstances.findMany({
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
      const proposalCount = instance.proposals?.length || 0;
      const uniqueParticipants = new Set(
        instance.proposals?.map((p) => p.submittedByProfileId)
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
    console.error('Error listing process instances:', error);
    throw new UnauthorizedError('Failed to list process instances');
  }
};
