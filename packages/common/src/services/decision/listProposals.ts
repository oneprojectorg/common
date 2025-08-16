import { and, asc, db, desc, eq, sql } from '@op/db/client';
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
        sql`${proposals.proposalData}::text ILIKE ${`%${search}%`}`,
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

    // Get proposals using Drizzle's declarative relational query style
    const orderColumn =
      orderBy === 'createdAt'
        ? proposals.createdAt
        : orderBy === 'updatedAt'
          ? proposals.updatedAt
          : orderBy === 'status'
            ? proposals.status
            : proposals.createdAt;

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
        decisions: true, // Include decisions to calculate count
      },
      limit,
      offset,
      orderBy: orderFn(orderColumn),
    });

    // Transform the results to match the expected structure and add decision counts
    // TODO: improve this with more streamlined types
    const proposalsWithCounts = proposalList.map((proposal) => {
      const processInstance = Array.isArray(proposal.processInstance)
        ? proposal.processInstance[0]
        : proposal.processInstance;
      const submittedBy = Array.isArray(proposal.submittedBy)
        ? proposal.submittedBy[0]
        : proposal.submittedBy;
      const decisions = Array.isArray(proposal.decisions)
        ? proposal.decisions
        : [];

      return {
        id: proposal.id,
        proposalData: proposal.proposalData,
        status: proposal.status,
        createdAt: proposal.createdAt,
        updatedAt: proposal.updatedAt,
        processInstance: processInstance
          ? {
              id: processInstance.id,
              name: processInstance.name,
              description: processInstance.description,
              instanceData: processInstance.instanceData,
              currentStateId: processInstance.currentStateId,
              status: processInstance.status,
              createdAt: processInstance.createdAt,
              updatedAt: processInstance.updatedAt,
              process: processInstance.process
                ? {
                    id: processInstance.process.id,
                    name: processInstance.process.name,
                    description: processInstance.process.description,
                    createdAt: processInstance.process.createdAt,
                    updatedAt: processInstance.process.updatedAt,
                    processSchema: processInstance.process.processSchema,
                  }
                : undefined,
            }
          : undefined,
        submittedBy: submittedBy,
        decisionCount: decisions.length,
      };
    });

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
    throw new Error('Failed to list proposals');
  }
};
