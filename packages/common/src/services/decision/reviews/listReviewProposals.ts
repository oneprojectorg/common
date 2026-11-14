import {
  type SQL,
  and,
  asc,
  count,
  db,
  desc,
  eq,
  exists,
  ne,
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
} from '../../../utils';
import { getInstance } from '../getInstance';
import { listProposals } from '../listProposals';
import { resolveProposalListScope } from '../resolveProposalListScope';
import { assertCanReadPhaseReviews } from '../reviewHelpers';
import {
  type ListReviewProposalsInput,
  type ReviewProposalList,
  type ReviewProposalSort,
  reviewProposalListSchema,
} from '../schemas/reviews';

/**
 * The review page's "All proposals" list: the phase's submitted proposals,
 * filtered by title search and by every given category term, newest first or
 * by submitted review count.
 *
 * Gated like the tab itself: admins, or reviewers on a phase with open
 * reviews. Rows are the ones `proposal.list` would show the caller — the scope
 * comes from `resolveProposalListScope` — minus drafts, which have nothing to
 * review. The page is picked here and hydrated by `listProposals`, so items
 * keep the `proposal.list` shape.
 */
export async function listReviewProposals({
  user,
  processInstanceId,
  phaseId,
  search,
  categoryIds = [],
  sort = 'newest',
  cursor,
  limit = PAGE_LIMIT.md,
}: ListReviewProposalsInput & { user: User }): Promise<ReviewProposalList> {
  const instance = await getInstance({ instanceId: processInstanceId, user });
  const effectivePhaseId = phaseId ?? instance.currentStateId ?? undefined;

  await assertCanReadPhaseReviews({
    instance,
    phaseId: effectivePhaseId,
    user,
  });

  const decodedCursor = decodeReviewProposalCursor(cursor, sort);

  const scope = await resolveProposalListScope({
    input: { processInstanceId, phaseId, search },
    user,
  });

  if (scope.isEmpty) {
    return { items: [], next: null, total: 0 };
  }

  const where = and(
    scope.buildWhereClause(proposals),
    ne(proposals.status, ProposalStatus.DRAFT),
    ...categoryIds.map((categoryId) => hasCategory(categoryId)),
  );

  const counts = reviewCounts({ processInstanceId, phaseId: effectivePhaseId });
  const submittedCount = sql<number>`coalesce(${counts.submittedCount}, 0)`;
  const assignedCount = sql<number>`coalesce(${counts.assignedCount}, 0)`;
  const { orderBy, afterCursor } = getReviewProposalOrder({
    sort,
    submittedCount,
    assignedCount,
    cursor: decodedCursor,
  });

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: proposals.id,
        createdAt: proposals.createdAt,
        submittedCount: submittedCount.mapWith(Number),
        assignedCount: assignedCount.mapWith(Number),
      })
      .from(proposals)
      .leftJoin(counts, eq(counts.proposalId, proposals.id))
      .where(and(where, afterCursor))
      .orderBy(...orderBy)
      .limit(limit + 1),
    db.select({ total: count() }).from(proposals).where(where),
  ]);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const lastRow = pageRows[pageRows.length - 1];

  return reviewProposalListSchema.parse({
    items: await hydrateInOrder({
      processInstanceId,
      proposalIds: pageRows.map((row) => row.id),
      user,
    }),
    next:
      hasMore && lastRow?.createdAt
        ? encodeCursor<ReviewProposalCursor>(
            toReviewProposalCursor({
              sort,
              row: { ...lastRow, createdAt: lastRow.createdAt },
            }),
          )
        : null,
    total: totals?.total ?? 0,
  });
}

/**
 * Per proposal, its assignments in the phase and how many of them hold a
 * submitted review — the same rows and rule as the review aggregates.
 */
function reviewCounts({
  processInstanceId,
  phaseId,
}: {
  processInstanceId: string;
  phaseId: string | undefined;
}) {
  return db
    .select({
      proposalId: proposalReviewAssignments.proposalId,
      submittedCount:
        sql<number>`(count(${proposalReviews.id}) filter (where ${proposalReviews.state} = ${ProposalReviewState.SUBMITTED}))::int`.as(
          'submitted_count',
        ),
      assignedCount: sql<number>`count(*)::int`.as('assigned_count'),
    })
    .from(proposalReviewAssignments)
    .leftJoin(
      proposalReviews,
      eq(proposalReviews.assignmentId, proposalReviewAssignments.id),
    )
    .where(
      and(
        eq(proposalReviewAssignments.processInstanceId, processInstanceId),
        phaseId ? eq(proposalReviewAssignments.phaseId, phaseId) : undefined,
      ),
    )
    .groupBy(proposalReviewAssignments.proposalId)
    .as('review_counts');
}

const reviewProposalCursorSchema = z.discriminatedUnion('sort', [
  z.object({
    sort: z.literal('newest'),
    createdAt: z.string(),
    id: z.uuid(),
  }),
  z.object({
    sort: z.enum(['fewestReviews', 'mostReviews']),
    submittedCount: z.number().int().nonnegative(),
    assignedCount: z.number().int().nonnegative(),
    createdAt: z.string(),
    id: z.uuid(),
  }),
]);

type ReviewProposalCursor = z.infer<typeof reviewProposalCursorSchema>;

/**
 * Each sort runs one direction over its whole key, so the cursor is a single
 * row comparison. Fewest reviews puts the oldest first on a tie, most reviews
 * the newest.
 */
function getReviewProposalOrder({
  sort,
  submittedCount,
  assignedCount,
  cursor,
}: {
  sort: ReviewProposalSort;
  submittedCount: SQL<number>;
  assignedCount: SQL<number>;
  cursor: ReviewProposalCursor | undefined;
}): { orderBy: SQL[]; afterCursor: SQL | undefined } {
  if (sort === 'newest') {
    return {
      orderBy: [desc(proposals.createdAt), desc(proposals.id)],
      afterCursor:
        cursor?.sort === 'newest'
          ? sql`(${proposals.createdAt}, ${proposals.id}) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`
          : undefined,
    };
  }

  const direction = sort === 'fewestReviews' ? asc : desc;
  const keys = [
    submittedCount,
    assignedCount,
    proposals.createdAt,
    proposals.id,
  ];

  return {
    orderBy: keys.map((key) => direction(key)),
    afterCursor:
      cursor && cursor.sort !== 'newest'
        ? sql`(${submittedCount}, ${assignedCount}, ${proposals.createdAt}, ${proposals.id}) ${sort === 'fewestReviews' ? sql`>` : sql`<`} (${cursor.submittedCount}::int, ${cursor.assignedCount}::int, ${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`
        : undefined,
  };
}

function toReviewProposalCursor({
  sort,
  row,
}: {
  sort: ReviewProposalSort;
  row: {
    id: string;
    createdAt: string;
    submittedCount: number;
    assignedCount: number;
  };
}): ReviewProposalCursor {
  if (sort === 'newest') {
    return { sort, createdAt: row.createdAt, id: row.id };
  }
  return {
    sort,
    submittedCount: row.submittedCount,
    assignedCount: row.assignedCount,
    createdAt: row.createdAt,
    id: row.id,
  };
}

function decodeReviewProposalCursor(
  cursor: string | null | undefined,
  sort: ReviewProposalSort,
): ReviewProposalCursor | undefined {
  if (!cursor) {
    return undefined;
  }

  // `decodeCursor` throws a bare 500 on unreadable input; keep every bad
  // cursor a 400.
  const decoded = ((): unknown => {
    try {
      return decodeCursor<unknown>(cursor);
    } catch {
      return undefined;
    }
  })();

  const result = reviewProposalCursorSchema.safeParse(decoded);
  if (!result.success || result.data.sort !== sort) {
    throw new ValidationError('Invalid cursor');
  }
  return result.data;
}

/** One EXISTS per term, so a proposal must carry all of them. */
function hasCategory(categoryId: string): SQL {
  return exists(
    db
      .select({ proposalId: proposalCategories.proposalId })
      .from(proposalCategories)
      .where(
        and(
          eq(proposalCategories.proposalId, proposals.id),
          eq(proposalCategories.taxonomyTermId, categoryId),
        ),
      ),
  );
}

/** Hydrates the page through `listProposals` and keeps the order picked here. */
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
