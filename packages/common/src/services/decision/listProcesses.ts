import { and, db, desc, eq, ilike, sql } from '@op/db/client';
import { decisionProcesses } from '@op/db/schema';

export interface ListProcessesInput {
  limit?: number;
  offset?: number;
  search?: string;
  createdByProfileId?: string;
}

export const listProcesses = async ({
  limit = 20,
  offset = 0,
  search,
  createdByProfileId,
}: ListProcessesInput = {}) => {
  try {
    const conditions = [];

    // Filter for new schema format using JSON operators
    // New format has: processSchema->'id', processSchema->'version', processSchema->'phases'
    conditions.push(sql`${decisionProcesses.processSchema}->>'id' IS NOT NULL`);
    conditions.push(
      sql`${decisionProcesses.processSchema}->>'version' IS NOT NULL`,
    );
    conditions.push(
      sql`${decisionProcesses.processSchema}->'phases' IS NOT NULL`,
    );

    if (search) {
      conditions.push(ilike(decisionProcesses.name, `%${search}%`));
    }

    if (createdByProfileId) {
      conditions.push(
        eq(decisionProcesses.createdByProfileId, createdByProfileId),
      );
    }

    const whereClause = and(...conditions);

    const [processes, totalResult] = await Promise.all([
      db._query.decisionProcesses.findMany({
        where: whereClause,
        with: {
          createdBy: true,
        },
        orderBy: [desc(decisionProcesses.createdAt)],
        limit: limit + 1, // Get one extra to check if there are more
        offset,
      }),
      db
        .select({ count: sql<string>`count(*)` })
        .from(decisionProcesses)
        .where(whereClause),
    ]);

    const hasMore = processes.length > limit;
    const resultProcesses = hasMore ? processes.slice(0, -1) : processes;
    const total = Number(totalResult[0]?.count ?? 0);

    return {
      processes: resultProcesses,
      total,
      hasMore,
    };
  } catch (error) {
    console.error('Error listing decision processes:', error);
    return {
      processes: [],
      total: 0,
      hasMore: false,
    };
  }
};
