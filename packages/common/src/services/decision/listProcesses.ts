import { db, desc, eq, ilike, sql } from '@op/db/client';
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

    if (search) {
      conditions.push(ilike(decisionProcesses.name, `%${search}%`));
    }

    if (createdByProfileId) {
      conditions.push(eq(decisionProcesses.createdByProfileId, createdByProfileId));
    }

    const whereClause = conditions.length > 0 ? sql`${sql.raw(conditions.map(() => '?').join(' AND '))}` : undefined;

    const [processes, totalResult] = await Promise.all([
      db.query.decisionProcesses.findMany({
        where: whereClause,
        with: {
          createdBy: true,
        },
        orderBy: [desc(decisionProcesses.createdAt)],
        limit: limit + 1, // Get one extra to check if there are more
        offset,
      }),
      db
        .select({ count: sql<number>`count(*)` })
        .from(decisionProcesses)
        .where(whereClause),
    ]);

    const hasMore = processes.length > limit;
    const resultProcesses = hasMore ? processes.slice(0, -1) : processes;
    const total = totalResult[0]?.count ?? 0;

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