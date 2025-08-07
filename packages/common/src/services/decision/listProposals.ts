import { db, eq, and, desc, asc, sql } from '@op/db/client';
import { proposals, users } from '@op/db/schema';
import { User } from '@op/supabase/lib';

import { UnauthorizedError } from '../../utils';

export interface ListProposalsInput {
  processInstanceId?: string;
  submittedByProfileId?: string;
  status?: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected';
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'status';
  orderDirection?: 'asc' | 'desc';
}

export const listProposals = async ({
  input,
  user,
}: {
  input: ListProposalsInput;
  user: User;
}) => {
  if (!user) {
    throw new UnauthorizedError('User must be authenticated');
  }

  try {
    // Get the database user record to access currentProfileId
    const dbUser = await db.query.users.findFirst({
      where: eq(users.authUserId, user.id),
    });

    if (!dbUser || !dbUser.currentProfileId) {
      throw new UnauthorizedError('User must have an active profile');
    }

    const {
      processInstanceId,
      submittedByProfileId,
      status,
      search,
      limit = 20,
      offset = 0,
      orderBy = 'createdAt',
      orderDirection = 'desc',
    } = input;

    // Build filter conditions
    const conditions = [];

    if (processInstanceId) {
      conditions.push(eq(proposals.processInstanceId, processInstanceId));
    }

    if (submittedByProfileId) {
      conditions.push(eq(proposals.submittedByProfileId, submittedByProfileId));
    }

    if (status) {
      conditions.push(eq(proposals.status, status));
    }

    if (search) {
      // Search in proposal data (JSONB)
      conditions.push(
        sql`${proposals.proposalData}::text ILIKE ${`%${search}%`}`
      );
    }

    // Combine conditions
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count for pagination
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(proposals)
      .where(whereClause);
    
    const count = countResult[0]?.count || 0;

    // Get proposals with relations
    const orderColumn = 
      orderBy === 'createdAt' ? proposals.createdAt :
      orderBy === 'updatedAt' ? proposals.updatedAt :
      orderBy === 'status' ? proposals.status :
      proposals.createdAt;

    const orderFn = orderDirection === 'asc' ? asc : desc;

    const proposalList = await db.query.proposals.findMany({
      where: whereClause,
      with: {
        processInstance: {
          with: {
            process: true,
          },
        },
        submittedBy: true,
      },
      limit,
      offset,
      orderBy: orderFn(orderColumn),
    });

    // Add decision count to each proposal
    const proposalsWithCounts = await Promise.all(
      proposalList.map(async (proposal) => {
        const decisionCountResult = await db
          .select({ decisionCount: sql<number>`count(*)` })
          .from(proposals)
          .where(eq(proposals.id, proposal.id));

        const decisionCount = decisionCountResult[0]?.decisionCount || 0;

        return {
          ...proposal,
          decisionCount: Number(decisionCount),
        };
      })
    );

    return {
      proposals: proposalsWithCounts,
      total: Number(count),
      hasMore: offset + limit < Number(count),
    };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    console.error('Error listing proposals:', error);
    throw new UnauthorizedError('Failed to list proposals');
  }
};