import {
  and,
  asc,
  db,
  desc,
  eq,
  exists,
  inArray,
  or,
  sql,
} from '@op/db/client';
import {
  ProposalReviewState,
  proposalCategories,
  proposalReviewAssignments,
  proposalReviews,
  proposals,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { count as countFn } from 'drizzle-orm';

import { UnauthorizedError, decodeCursor, encodeCursor } from '../../utils';
import { getInstance } from './getInstance';
import { getProposalIdsForPhase } from './getProposalsForPhase';
import {
  assembleProposalWithAggregates,
  computeAggregatesInJs,
  getScoredCriterionKeys,
  loadProposalDataForAggregation,
} from './proposalsWithReviewAggregates.shared';
import {
  type ProposalsWithReviewAggregatesList,
  proposalsWithReviewAggregatesListSchema,
} from './schemas/reviews';
import type { RubricTemplateSchema } from './types';

type SortBy = 'createdAt' | 'totalScore' | 'averageScore' | 'reviewsSubmitted';
type SortDir = 'asc' | 'desc';

type AggregatesCursor = {
  /** The sort column value of the last item on the previous page. */
  value: string | number;
  /** Tie-breaker so identical sort values still paginate deterministically. */
  id: string;
};

export interface ListProposalsWithReviewAggregatesInput {
  processInstanceId: string;
  /**
   * Phase that scopes the candidate set and the review aggregates.
   * Defaults to the instance's current phase.
   */
  phaseId?: string;
  categoryId?: string;
  sortBy?: SortBy;
  dir?: SortDir;
  limit?: number;
  cursor?: string;
}

const DEFAULT_LIMIT = 50;

/**
 * Admin-only paginated list of proposals belonging to a phase, enriched with
 * per-proposal review aggregates. Server-side aggregation is the load-bearing
 * reason this endpoint exists — sorting by `totalScore` / `averageScore` /
 * `reviewsSubmitted` must work across pagination boundaries.
 *
 * Pipeline:
 *   1. Auth + resolve scoped proposal IDs via `getProposalIdsForPhase`.
 *   2. Page query (LEFT JOIN agg subquery only when sorting by a computed
 *      column) + total count, run in parallel.
 *   3. Load full proposal data + categories for the page IDs in parallel,
 *      then compute the response aggregates in JS.
 *
 * The SQL agg subquery, when present, is only used to drive sort + cursor —
 * the response numbers always come from the JS aggregator, so list and
 * hydrate paths can't drift.
 */
export async function listProposalsWithReviewAggregates(
  input: ListProposalsWithReviewAggregatesInput & { user: User },
): Promise<ProposalsWithReviewAggregatesList> {
  const { user, processInstanceId } = input;

  const instance = await getInstance({ instanceId: processInstanceId, user });

  if (!instance.access.admin) {
    throw new UnauthorizedError(
      "You don't have admin access to this process instance",
    );
  }

  const rubricTemplate = (instance.instanceData.rubricTemplate ??
    null) as RubricTemplateSchema | null;
  const scoredCriterionKeys = getScoredCriterionKeys(rubricTemplate);

  const phaseId = input.phaseId ?? instance.currentStateId ?? undefined;

  const phaseProposalIds = await getProposalIdsForPhase({
    instanceId: processInstanceId,
    phaseId,
  });

  if (phaseProposalIds.length === 0) {
    return { items: [], total: 0, nextCursor: null };
  }

  const sortBy: SortBy = input.sortBy ?? 'createdAt';
  const sortDir: SortDir = input.dir ?? 'desc';
  const limit = input.limit ?? DEFAULT_LIMIT;
  const needsAggForSort = sortBy !== 'createdAt';

  // Per-review score expression: sum of integer rubric criteria. Non-numeric
  // criteria are ignored. NULL coalesces to 0 so a missing answer doesn't
  // poison the row. Falls back to 0 when no scored criteria exist.
  const perReviewScoreExpr =
    scoredCriterionKeys.length === 0
      ? sql`0`
      : sql.join(
          scoredCriterionKeys.map(
            (key) =>
              sql`COALESCE((${proposalReviews.reviewData}->'answers'->>${key})::numeric, 0)`,
          ),
          sql` + `,
        );

  // Aggregation subquery — only built when a computed sort needs it.
  // Scoped to (processInstanceId, phaseId, proposalId IN phase set) so the
  // GROUP BY only scans this phase's assignments for the relevant proposals.
  const aggSubquery = needsAggForSort
    ? db
        .select({
          proposalId: proposalReviewAssignments.proposalId,
          reviewsSubmitted:
            sql<number>`COUNT(DISTINCT CASE WHEN ${proposalReviews.state} = ${ProposalReviewState.SUBMITTED} THEN ${proposalReviews.id} END)::int`.as(
              'reviews_submitted',
            ),
          totalScore:
            sql<number>`COALESCE(SUM(CASE WHEN ${proposalReviews.state} = ${ProposalReviewState.SUBMITTED} THEN (${perReviewScoreExpr}) ELSE 0 END), 0)::numeric`.as(
              'total_score',
            ),
          averageScore:
            sql<number>`COALESCE(SUM(CASE WHEN ${proposalReviews.state} = ${ProposalReviewState.SUBMITTED} THEN (${perReviewScoreExpr}) ELSE 0 END), 0)::numeric / NULLIF(COUNT(DISTINCT CASE WHEN ${proposalReviews.state} = ${ProposalReviewState.SUBMITTED} THEN ${proposalReviews.id} END), 0)`.as(
              'average_score',
            ),
        })
        .from(proposalReviewAssignments)
        .leftJoin(
          proposalReviews,
          eq(proposalReviews.assignmentId, proposalReviewAssignments.id),
        )
        .where(
          and(
            eq(proposalReviewAssignments.processInstanceId, processInstanceId),
            ...(phaseId
              ? [eq(proposalReviewAssignments.phaseId, phaseId)]
              : []),
            inArray(proposalReviewAssignments.proposalId, phaseProposalIds),
          ),
        )
        .groupBy(proposalReviewAssignments.proposalId)
        .as('agg')
    : null;

  const baseConditions = [inArray(proposals.id, phaseProposalIds)];

  if (input.categoryId) {
    baseConditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(proposalCategories)
          .where(
            and(
              eq(proposalCategories.proposalId, proposals.id),
              eq(proposalCategories.taxonomyTermId, input.categoryId),
            ),
          ),
      ),
    );
  }

  // Sort key expression. For computed sorts, the agg subquery is required.
  let sortColumnExpr = proposals.createdAt as unknown as ReturnType<
    typeof sql<string>
  >;
  if (aggSubquery) {
    sortColumnExpr =
      sortBy === 'totalScore'
        ? (sql<number>`COALESCE(${aggSubquery.totalScore}, 0)` as unknown as ReturnType<
            typeof sql<string>
          >)
        : sortBy === 'averageScore'
          ? (sql<number>`COALESCE(${aggSubquery.averageScore}, 0)` as unknown as ReturnType<
              typeof sql<string>
            >)
          : sortBy === 'reviewsSubmitted'
            ? (sql<number>`COALESCE(${aggSubquery.reviewsSubmitted}, 0)` as unknown as ReturnType<
                typeof sql<string>
              >)
            : sortColumnExpr;
  }

  let cursorCondition: ReturnType<typeof and> | undefined;
  if (input.cursor) {
    const decoded = decodeCursor<AggregatesCursor>(input.cursor);
    const cmp = sortDir === 'asc' ? sql`>` : sql`<`;
    cursorCondition = or(
      sql`${sortColumnExpr} ${cmp} ${decoded.value}`,
      and(
        sql`${sortColumnExpr} = ${decoded.value}`,
        sql`${proposals.id} ${cmp} ${decoded.id}`,
      ),
    );
  }

  const pageConditions = cursorCondition
    ? [...baseConditions, cursorCondition]
    : baseConditions;

  const orderFn = sortDir === 'asc' ? asc : desc;

  // Page query: id + sort key only. Aggregates for the response are
  // computed in JS in trip 3 from the loaded reviews.
  const baseSelect = {
    id: proposals.id,
    sortValue: sortColumnExpr as unknown as ReturnType<typeof sql<string>>,
  };

  const pageQueryBuilder = aggSubquery
    ? db
        .select(baseSelect)
        .from(proposals)
        .leftJoin(aggSubquery, eq(aggSubquery.proposalId, proposals.id))
    : db.select(baseSelect).from(proposals);

  const pageQuery = pageQueryBuilder
    .where(and(...pageConditions))
    .orderBy(orderFn(sortColumnExpr), orderFn(proposals.id))
    .limit(limit + 1);

  const [pageRowsRaw, totalRows] = await Promise.all([
    pageQuery,
    db
      .select({ count: countFn() })
      .from(proposals)
      .where(and(...baseConditions)),
  ]);

  const hasMore = pageRowsRaw.length > limit;
  const pageRows = hasMore ? pageRowsRaw.slice(0, limit) : pageRowsRaw;
  const total = Number(totalRows[0]?.count ?? 0);

  if (pageRows.length === 0) {
    return { items: [], total, nextCursor: null };
  }

  const pageIds = pageRows.map((r) => r.id);

  const { proposalsById, categoriesByProposalId } =
    await loadProposalDataForAggregation({
      proposalIds: pageIds,
      processInstanceId,
      phaseId,
    });

  // Preserve the SQL sort order — `findMany({ where: in })` doesn't
  // guarantee any particular order.
  const items = pageIds.map((id) => {
    const proposal = proposalsById.get(id);
    if (!proposal) {
      throw new Error(`Page row missing full data: ${id}`);
    }
    const aggregates = computeAggregatesInJs(
      proposal.reviewAssignments,
      scoredCriterionKeys,
    );
    return assembleProposalWithAggregates({
      proposal,
      aggregates,
      categories: categoriesByProposalId.get(id) ?? [],
    });
  });

  let nextCursor: string | null = null;
  if (hasMore) {
    const lastRow = pageRows[pageRows.length - 1]!;
    nextCursor = encodeCursor<AggregatesCursor>({
      value: lastRow.sortValue ?? '',
      id: lastRow.id,
    });
  }

  return proposalsWithReviewAggregatesListSchema.parse({
    items,
    total,
    nextCursor,
  });
}
