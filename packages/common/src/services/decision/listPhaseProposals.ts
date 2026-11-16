import {
  type SQL,
  and,
  asc,
  count,
  db,
  desc,
  eq,
  exists,
  inArray,
  isNull,
  ne,
  or,
  sql,
} from '@op/db/client';
import {
  ProposalReviewState,
  ProposalStatus,
  proposalCategories,
  proposalReviewAssignments,
  proposalReviews,
  proposals,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { z } from 'zod';

import {
  PAGE_LIMIT,
  ValidationError,
  decodeCursor,
  encodeCursor,
  getCursorCondition,
} from '../../utils';
import { listProposals } from './listProposals';
import { resolveProposalListScope } from './resolveProposalListScope';
import {
  type PhaseProposalList,
  phaseProposalListSchema,
} from './schemas/proposal';
import type { ReviewProposalSort } from './schemas/reviews';

export interface ListPhaseProposalsInput {
  processInstanceId: string;
  /** Omitted means the current phase. */
  phaseIds?: string[];
  assignedToProfileId?: string;
  search?: string;
  categoryIds?: string[];
  /** Defaults to newest first. */
  sort?: ReviewProposalSort;
  cursor?: string | null;
  limit?: number;
  user: User;
}

/** Non-draft proposals of the phases, newest first or by review count. Checks only READ, so callers gate first. */
export async function listPhaseProposals({
  processInstanceId,
  phaseIds,
  assignedToProfileId,
  search,
  categoryIds = [],
  sort = 'newest',
  cursor,
  limit = PAGE_LIMIT.md,
  user,
}: ListPhaseProposalsInput): Promise<PhaseProposalList> {
  const decodedCursor = decodePhaseProposalCursor({ cursor, sort });

  const requestedPhaseIds: Array<string | undefined> = phaseIds ?? [undefined];
  const listScopes = await Promise.all(
    requestedPhaseIds.map((phaseId) =>
      resolveProposalListScope({
        input: { processInstanceId, phaseId, search },
        user,
      }),
    ),
  );

  const phaseScopes = listScopes.filter((listScope) => !listScope.isEmpty);
  const [firstScope] = listScopes;
  if (phaseScopes.length === 0 || !firstScope) {
    return { items: [], next: null, total: 0 };
  }

  const assignmentPhaseIds =
    phaseIds ??
    (firstScope.instance.currentStateId
      ? [firstScope.instance.currentStateId]
      : []);

  const buildWhere = (
    proposalsTable: typeof proposals,
    cursorCondition?: SQL,
  ): SQL =>
    and(
      or(
        ...phaseScopes.map((listScope) =>
          listScope.buildWhereClause(proposalsTable),
        ),
      ),
      ne(proposalsTable.status, ProposalStatus.DRAFT),
      ...categoryIds.map((categoryId) =>
        hasCategory({ proposalsTable, categoryId }),
      ),
      assignedToProfileId === undefined
        ? undefined
        : isAssignedTo({
            proposalsTable,
            processInstanceId,
            phaseIds: assignmentPhaseIds,
            reviewerProfileId: assignedToProfileId,
          }),
      cursorCondition,
    ) ?? sql`false`;

  const [rows, [totals]] = await Promise.all([
    sort === 'newest'
      ? listNewestRows({ buildWhere, cursor: decodedCursor, limit })
      : listReviewCountRows({
          buildWhere,
          sort,
          processInstanceId,
          phaseIds: assignmentPhaseIds,
          cursor: decodedCursor,
          limit,
        }),
    // The relational API has no aggregate, so the total stays a select.
    db.select({ total: count() }).from(proposals).where(buildWhere(proposals)),
  ]);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const lastRow = pageRows[pageRows.length - 1];

  return phaseProposalListSchema.parse({
    items: await hydrateInOrder({
      processInstanceId,
      proposalIds: pageRows.map((row) => row.id),
      user,
    }),
    next:
      hasMore && lastRow?.createdAt
        ? encodeCursor<PhaseProposalCursor>({
            value: lastRow.createdAt,
            id: lastRow.id,
            counts: lastRow.counts,
          })
        : null,
    total: totals?.total ?? 0,
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

async function listNewestRows({
  buildWhere,
  cursor,
  limit,
}: {
  buildWhere: BuildWhere;
  cursor: PhaseProposalCursor | undefined;
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

/**
 * Orders by submitted reviews, then assignments, then createdAt and id, all
 * one direction, so the cursor is a single row comparison.
 */
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
  cursor: PhaseProposalCursor | undefined;
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

/** Same rule as the review aggregates: every assignment, and its review only once submitted. */
function reviewCountsByProposal({
  processInstanceId,
  phaseIds,
}: {
  processInstanceId: string;
  phaseIds: string[];
}) {
  return db
    .select({
      proposalId: proposalReviewAssignments.proposalId,
      submitted:
        sql<number>`(count(${proposalReviews.id}) filter (where ${proposalReviews.state} = ${ProposalReviewState.SUBMITTED}))::int`.as(
          'submitted_count',
        ),
      assigned: sql<number>`count(*)::int`.as('assigned_count'),
    })
    .from(proposalReviewAssignments)
    .leftJoin(
      proposalReviews,
      eq(proposalReviews.assignmentId, proposalReviewAssignments.id),
    )
    .where(
      and(
        eq(proposalReviewAssignments.processInstanceId, processInstanceId),
        inArray(proposalReviewAssignments.phaseId, phaseIds),
      ),
    )
    .groupBy(proposalReviewAssignments.proposalId)
    .as('review_counts');
}

const reviewCountsSchema = z.object({
  sort: z.enum(['fewestReviews', 'mostReviews']),
  submitted: z.number().int().nonnegative(),
  assigned: z.number().int().nonnegative(),
});

type ReviewCounts = z.infer<typeof reviewCountsSchema>;

const phaseProposalCursorSchema = z.object({
  // A non-date value would fail in Postgres as a 500.
  value: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
  id: z.uuid(),
  // Set only by the review-count sorts.
  counts: reviewCountsSchema.optional(),
});

type PhaseProposalCursor = z.infer<typeof phaseProposalCursorSchema>;

function decodePhaseProposalCursor({
  cursor,
  sort,
}: {
  cursor: string | null | undefined;
  sort: ReviewProposalSort;
}): PhaseProposalCursor | undefined {
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

  const result = phaseProposalCursorSchema.safeParse(decoded);
  // A cursor from another sort would page from the wrong key.
  const cursorSort = result.data?.counts?.sort ?? 'newest';
  if (!result.success || cursorSort !== sort) {
    throw new ValidationError('Invalid cursor');
  }
  return result.data;
}

function isAssignedTo({
  proposalsTable,
  processInstanceId,
  phaseIds,
  reviewerProfileId,
}: {
  proposalsTable: typeof proposals;
  processInstanceId: string;
  phaseIds: string[];
  reviewerProfileId: string;
}): SQL {
  return exists(
    db
      .select({ id: proposalReviewAssignments.id })
      .from(proposalReviewAssignments)
      .where(
        and(
          eq(proposalReviewAssignments.proposalId, proposalsTable.id),
          eq(proposalReviewAssignments.processInstanceId, processInstanceId),
          inArray(proposalReviewAssignments.phaseId, phaseIds),
          eq(proposalReviewAssignments.reviewerProfileId, reviewerProfileId),
          isNull(proposalReviewAssignments.deletedAt),
        ),
      ),
  );
}

/** One EXISTS per term, so a proposal must carry all of them. */
function hasCategory({
  proposalsTable,
  categoryId,
}: {
  proposalsTable: typeof proposals;
  categoryId: string;
}): SQL {
  return exists(
    db
      .select({ proposalId: proposalCategories.proposalId })
      .from(proposalCategories)
      .where(
        and(
          eq(proposalCategories.proposalId, proposalsTable.id),
          eq(proposalCategories.taxonomyTermId, categoryId),
        ),
      ),
  );
}

async function hydrateInOrder({
  processInstanceId,
  proposalIds,
  user,
}: {
  processInstanceId: string;
  proposalIds: string[];
  user: User;
}) {
  if (proposalIds.length === 0) {
    return [];
  }

  const { items } = await listProposals({
    input: { processInstanceId, proposalIds, limit: proposalIds.length },
    user,
  });
  const byId = new Map(items.map((item) => [item.id, item]));

  return proposalIds.flatMap((id) => byId.get(id) ?? []);
}
