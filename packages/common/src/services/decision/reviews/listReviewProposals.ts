import { type SQL, asc, count, db, desc, eq, sql } from '@op/db/client';
import { proposals } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { z } from 'zod';

import {
  PAGE_LIMIT,
  ValidationError,
  decodeCursor,
  encodeCursor,
  getCursorCondition,
} from '../../../utils';
import { getInstance } from '../getInstance';
import {
  buildProposalFilterConditions,
  hydrateProposalsInOrder,
  resolvePhaseProposalQuery,
} from '../phaseProposalQuery';
import { assertCanReadPhaseReviews } from '../reviewHelpers';
import {
  type ListReviewProposalsInput,
  type ReviewProposalList,
  type ReviewProposalSort,
  reviewProposalListSchema,
} from '../schemas/reviews';
import {
  hasReviewStatus,
  reviewCountsByProposal,
} from './reviewProposalCounts';

/** The review page's All proposals tab, gated by `assertCanReadPhaseReviews`. */
export async function listReviewProposals({
  user,
  processInstanceId,
  phaseId,
  search,
  categoryIds = [],
  sort,
  status,
  cursor,
  limit = PAGE_LIMIT.md,
}: ListReviewProposalsInput & { user: User }): Promise<ReviewProposalList> {
  const instance = await getInstance({ instanceId: processInstanceId, user });

  await assertCanReadPhaseReviews({
    instance,
    phaseId: phaseId ?? instance.currentStateId ?? undefined,
    user,
  });

  const decodedCursor = decodeReviewProposalCursor({ cursor, sort });

  const query = await resolvePhaseProposalQuery({
    processInstanceId,
    phaseIds: phaseId === undefined ? undefined : [phaseId],
    user,
  });
  if (query.isEmpty) {
    return { items: [], next: null, total: 0, unfilteredTotal: 0 };
  }

  const buildWhere: BuildWhere = (proposalsTable, cursorCondition) =>
    query.buildWhere(proposalsTable, [
      ...buildProposalFilterConditions({ proposalsTable, search, categoryIds }),
      status === undefined
        ? undefined
        : hasReviewStatus({
            proposalsTable,
            processInstanceId,
            phaseIds: query.phaseIds,
            status,
          }),
      cursorCondition,
    ]);
  const isFiltered =
    status !== undefined ||
    buildProposalFilterConditions({
      proposalsTable: proposals,
      search,
      categoryIds,
    }).length > 0;

  const [rows, total, unfilteredTotal] = await Promise.all([
    sort === 'newest'
      ? listNewestRows({ buildWhere, cursor: decodedCursor, limit })
      : listReviewCountRows({
          buildWhere,
          sort,
          processInstanceId,
          phaseIds: query.phaseIds,
          cursor: decodedCursor,
          limit,
        }),
    countProposals(buildWhere(proposals)),
    isFiltered ? countProposals(query.buildWhere(proposals, [])) : undefined,
  ]);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const lastRow = pageRows[pageRows.length - 1];

  return reviewProposalListSchema.parse({
    items: await hydrateProposalsInOrder({
      processInstanceId,
      proposalIds: pageRows.map((row) => row.id),
      user,
    }),
    next:
      hasMore && lastRow?.createdAt
        ? encodeCursor<ReviewProposalCursor>({
            value: lastRow.createdAt,
            id: lastRow.id,
            counts: lastRow.counts,
          })
        : null,
    total,
    unfilteredTotal: unfilteredTotal ?? total,
  });
}

type BuildWhere = (
  proposalsTable: typeof proposals,
  cursorCondition?: SQL,
) => SQL;

type PageRow = {
  id: string;
  createdAt: string | null;
  counts?: ReviewCounts;
};

async function countProposals(where: SQL): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(proposals)
    .where(where);
  return row?.total ?? 0;
}

async function listNewestRows({
  buildWhere,
  cursor,
  limit,
}: {
  buildWhere: BuildWhere;
  cursor: ReviewProposalCursor | undefined;
  limit: number;
}): Promise<PageRow[]> {
  return db.query.proposals.findMany({
    columns: { id: true, createdAt: true },
    where: {
      RAW: (table) =>
        buildWhere(
          table,
          getCursorCondition({
            column: table.createdAt,
            tieBreakerColumn: table.id,
            cursor,
            direction: 'desc',
          }),
        ),
    },
    orderBy: (table, { desc }) => [desc(table.createdAt), desc(table.id)],
    limit: limit + 1,
  });
}

/** Every key sorts in one direction, so the cursor is one row comparison. */
async function listReviewCountRows({
  buildWhere,
  sort,
  processInstanceId,
  phaseIds,
  cursor,
  limit,
}: {
  buildWhere: BuildWhere;
  sort: Exclude<ReviewProposalSort, 'newest'>;
  processInstanceId: string;
  phaseIds: string[];
  cursor: ReviewProposalCursor | undefined;
  limit: number;
}): Promise<PageRow[]> {
  const counts = reviewCountsByProposal({ processInstanceId, phaseIds });
  const submitted = sql<number>`coalesce(${counts.submitted}, 0)`;
  const assigned = sql<number>`coalesce(${counts.assigned}, 0)`;
  const direction = sort === 'fewestReviews' ? asc : desc;
  const comparison = sort === 'fewestReviews' ? sql`>` : sql`<`;

  const afterCursor = cursor?.counts
    ? sql`(${submitted}, ${assigned}, ${proposals.createdAt}, ${proposals.id}) ${comparison} (${cursor.counts.submitted}::int, ${cursor.counts.assigned}::int, ${cursor.value}::timestamptz, ${cursor.id}::uuid)`
    : undefined;

  // An aggregate join and order, which the relational API cannot express.
  const rows = await db
    .select({
      id: proposals.id,
      createdAt: proposals.createdAt,
      submitted: submitted.mapWith(Number),
      assigned: assigned.mapWith(Number),
    })
    .from(proposals)
    .leftJoin(counts, eq(counts.proposalId, proposals.id))
    .where(buildWhere(proposals, afterCursor))
    .orderBy(
      direction(submitted),
      direction(assigned),
      direction(proposals.createdAt),
      direction(proposals.id),
    )
    .limit(limit + 1);

  return rows.map(({ id, createdAt, submitted, assigned }) => ({
    id,
    createdAt,
    counts: { sort, submitted, assigned },
  }));
}

const reviewCountsSchema = z.object({
  sort: z.enum(['fewestReviews', 'mostReviews']),
  submitted: z.number().int().nonnegative(),
  assigned: z.number().int().nonnegative(),
});

type ReviewCounts = z.infer<typeof reviewCountsSchema>;

const reviewProposalCursorSchema = z.object({
  value: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
  id: z.uuid(),
  counts: reviewCountsSchema.optional(),
});

type ReviewProposalCursor = z.infer<typeof reviewProposalCursorSchema>;

function decodeReviewProposalCursor({
  cursor,
  sort,
}: {
  cursor: string | null | undefined;
  sort: ReviewProposalSort;
}): ReviewProposalCursor | undefined {
  if (!cursor) {
    return undefined;
  }

  const decoded = ((): unknown => {
    try {
      return decodeCursor<unknown>(cursor);
    } catch {
      return undefined;
    }
  })();

  const result = reviewProposalCursorSchema.safeParse(decoded);
  const cursorSort = result.data?.counts?.sort ?? 'newest';
  if (!result.success || cursorSort !== sort) {
    throw new ValidationError('Invalid cursor');
  }
  return result.data;
}
