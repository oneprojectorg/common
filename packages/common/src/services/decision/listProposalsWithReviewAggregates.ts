import {
  and,
  asc,
  db,
  desc,
  eq,
  exists,
  inArray,
  ne,
  or,
  sql,
} from '@op/db/client';
import {
  type ProposalReviewAssignmentStatus,
  ProposalReviewState,
  ProposalStatus,
  proposalCategories,
  proposalReviewAssignments,
  proposalReviews,
  proposals,
  taxonomyTerms,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { count as countFn } from 'drizzle-orm';

import { UnauthorizedError, decodeCursor, encodeCursor } from '../../utils';
import { getInstance } from './getInstance';
import { getRubricScoringInfo } from './getRubricScoringInfo';
import { parseProposalData } from './proposalDataSchema';
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

interface HydrationInput {
  processInstanceId: string;
  proposalIds: string[];
}

interface PaginatedInput {
  processInstanceId: string;
  categoryId?: string;
  status?: ProposalReviewAssignmentStatus;
  sortBy?: SortBy;
  dir?: SortDir;
  limit?: number;
  cursor?: string;
}

export type ListProposalsWithReviewAggregatesInput =
  | HydrationInput
  | PaginatedInput;

/**
 * Admin-only proposal list with per-proposal review aggregates computed
 * server-side. Operates in two mutually-exclusive modes:
 *
 * - **Hydration** (`proposalIds`): caller-owned ID list, no sorting or
 *   pagination. Used by Screens 0/1 to enrich cards from
 *   `listReviewAssignments`.
 * - **Pagination** (`sortBy` / `cursor`): endpoint owns the list.
 *   Server-side aggregation is the load-bearing reason this endpoint
 *   exists — sorting by `totalScore` / `averageScore` must work across
 *   pagination boundaries (Screen 2).
 *
 * The rubric template is intentionally NOT returned: it's static per
 * instance and the client already has it loaded. `criterionId` and
 * `optionKey` in `optionCounts` are the rubric property keys.
 */
export async function listProposalsWithReviewAggregates(
  input: ListProposalsWithReviewAggregatesInput & { user: User },
): Promise<ProposalsWithReviewAggregatesList> {
  const { user, processInstanceId } = input;
  const isHydration = 'proposalIds' in input;

  const instance = await getInstance({ instanceId: processInstanceId, user });

  if (!instance.access.admin) {
    throw new UnauthorizedError(
      "You don't have admin access to this process instance",
    );
  }

  const rubricTemplate = (instance.instanceData.rubricTemplate ??
    null) as RubricTemplateSchema | null;
  const scoredCriterionKeys = rubricTemplate
    ? getRubricScoringInfo(rubricTemplate)
        .criteria.filter((c) => c.scored)
        .map((c) => c.key)
    : [];

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

  // Aggregation subquery: per-proposal rollup of assignments + submitted
  // reviews. LEFT JOIN keeps proposals with zero submissions in the result
  // (they show up with totalScore=0 / reviewsSubmitted=0).
  const aggSubquery = db
    .select({
      proposalId: proposalReviewAssignments.proposalId,
      assignmentsTotal:
        sql<number>`COUNT(DISTINCT ${proposalReviewAssignments.id})::int`.as(
          'assignments_total',
        ),
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
    .where(eq(proposalReviewAssignments.processInstanceId, processInstanceId))
    .groupBy(proposalReviewAssignments.proposalId)
    .as('agg');

  // Compose mode-specific WHERE conditions on top of the common filter set
  // (instance + non-draft). Filters that touch sibling tables go in as
  // EXISTS subqueries so the page query stays a single round-trip.
  const baseConditions = [
    eq(proposals.processInstanceId, processInstanceId),
    ne(proposals.status, ProposalStatus.DRAFT),
  ];

  let sortColumnExpr = proposals.createdAt as unknown as ReturnType<
    typeof sql<string>
  >;
  let sortDir: SortDir = 'desc';
  let limit = Number.POSITIVE_INFINITY;
  let cursorCondition: ReturnType<typeof and> | undefined;

  if (isHydration) {
    baseConditions.push(inArray(proposals.id, input.proposalIds));
  } else {
    const sortBy = input.sortBy ?? 'createdAt';
    sortDir = input.dir ?? 'desc';
    limit = input.limit ?? 50;

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

    if (input.status) {
      baseConditions.push(
        exists(
          db
            .select({ one: sql`1` })
            .from(proposalReviewAssignments)
            .where(
              and(
                eq(proposalReviewAssignments.proposalId, proposals.id),
                eq(
                  proposalReviewAssignments.processInstanceId,
                  processInstanceId,
                ),
                eq(proposalReviewAssignments.status, input.status),
              ),
            ),
        ),
      );
    }

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
            : (proposals.createdAt as unknown as ReturnType<
                typeof sql<string>
              >);

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
  }

  const pageConditions = cursorCondition
    ? [...baseConditions, cursorCondition]
    : baseConditions;

  const orderFn = sortDir === 'asc' ? asc : desc;

  // Page query: just IDs + agg numbers + sort key. Full proposal data is
  // loaded by the relational query below; this query exists primarily to
  // resolve the candidate set + sort by computed aggregates.
  const pageQuery = db
    .select({
      id: proposals.id,
      createdAt: proposals.createdAt,
      assignmentsTotal: sql<number>`COALESCE(${aggSubquery.assignmentsTotal}, 0)::int`,
      reviewsSubmitted: sql<number>`COALESCE(${aggSubquery.reviewsSubmitted}, 0)::int`,
      totalScore: sql<number>`COALESCE(${aggSubquery.totalScore}, 0)::numeric`,
      averageScore: sql<number>`COALESCE(${aggSubquery.averageScore}, 0)::numeric`,
    })
    .from(proposals)
    .leftJoin(aggSubquery, eq(aggSubquery.proposalId, proposals.id))
    .where(and(...pageConditions))
    .orderBy(orderFn(sortColumnExpr), orderFn(proposals.id))
    .$dynamic();

  // Run the page query and (in paginated mode) the total-count query in
  // parallel. Hydration mode has no notion of "total beyond items".
  const [pageRowsRaw, totalRows] = await Promise.all([
    Number.isFinite(limit) ? pageQuery.limit(limit + 1) : pageQuery,
    isHydration
      ? Promise.resolve(null)
      : db
          .select({ count: countFn() })
          .from(proposals)
          .where(and(...baseConditions)),
  ]);

  const hasMore = Number.isFinite(limit) && pageRowsRaw.length > limit;
  const pageRows = hasMore ? pageRowsRaw.slice(0, limit) : pageRowsRaw;

  if (pageRows.length === 0) {
    return {
      items: [],
      total: totalRows ? Number(totalRows[0]?.count ?? 0) : 0,
      nextCursor: null,
    };
  }

  const pageIds = pageRows.map((r) => r.id);
  const aggByProposalId = new Map(pageRows.map((r) => [r.id, r]));

  // Full data via relational query: profile, submittedBy, reviewer roster
  // (with reviewer profile + avatar), and submitted reviews per assignment
  // for option-count tallies. Plus categories — loaded as a parallel join
  // since proposals → categories isn't in the v2 relations.
  const [proposalsFull, categoryRows] = await Promise.all([
    db.query.proposals.findMany({
      where: { id: { in: pageIds } },
      with: {
        profile: { with: { avatarImage: true } },
        submittedBy: { with: { avatarImage: true } },
        reviewAssignments: {
          where: { processInstanceId },
          with: {
            reviewer: { with: { avatarImage: true } },
            reviews: true,
          },
        },
      },
    }),
    db
      .select({
        proposalId: proposalCategories.proposalId,
        id: taxonomyTerms.id,
        label: taxonomyTerms.label,
        termUri: taxonomyTerms.termUri,
      })
      .from(proposalCategories)
      .innerJoin(
        taxonomyTerms,
        eq(taxonomyTerms.id, proposalCategories.taxonomyTermId),
      )
      .where(inArray(proposalCategories.proposalId, pageIds)),
  ]);

  const proposalsById = new Map(proposalsFull.map((p) => [p.id, p]));

  type CategoryEntry = { id: string; label: string; termUri: string };
  const categoriesByProposalId = new Map<string, CategoryEntry[]>();
  for (const row of categoryRows) {
    const list = categoriesByProposalId.get(row.proposalId) ?? [];
    list.push({ id: row.id, label: row.label, termUri: row.termUri });
    categoriesByProposalId.set(row.proposalId, list);
  }

  // Preserve the page order from the SQL sort — `findMany({ where: in })`
  // doesn't guarantee any particular order.
  const items = pageIds.map((id) => {
    const proposal = proposalsById.get(id);
    const aggRow = aggByProposalId.get(id);
    if (!proposal || !aggRow) {
      throw new Error(`Page row missing full data: ${id}`);
    }

    const reviewers = proposal.reviewAssignments.map((a) => ({
      profile: a.reviewer,
      status: a.status,
    }));

    const optionCounts = computeOptionCounts(proposal.reviewAssignments);

    return {
      id: proposal.id,
      processInstanceId: proposal.processInstanceId,
      proposalData: parseProposalData(proposal.proposalData),
      status: proposal.status,
      visibility: proposal.visibility,
      profileId: proposal.profileId,
      profile: proposal.profile,
      submittedBy: proposal.submittedBy,
      createdAt: proposal.createdAt,
      updatedAt: proposal.updatedAt,
      aggregates: {
        assignmentsTotal: Number(aggRow.assignmentsTotal),
        reviewsSubmitted: Number(aggRow.reviewsSubmitted),
        totalScore: Number(aggRow.totalScore),
        averageScore: Number(aggRow.averageScore),
        optionCounts,
        reviewers,
      },
      categories: categoriesByProposalId.get(id) ?? [],
    };
  });

  let nextCursor: string | null = null;
  if (hasMore && !isHydration) {
    const lastRow = pageRows[pageRows.length - 1]!;
    const sortBy = (input as PaginatedInput).sortBy ?? 'createdAt';
    const cursorValue =
      sortBy === 'totalScore'
        ? Number(lastRow.totalScore)
        : sortBy === 'averageScore'
          ? Number(lastRow.averageScore)
          : sortBy === 'reviewsSubmitted'
            ? Number(lastRow.reviewsSubmitted)
            : (lastRow.createdAt ?? '');
    nextCursor = encodeCursor<AggregatesCursor>({
      value: cursorValue,
      id: lastRow.id,
    });
  }

  const total = isHydration ? items.length : Number(totalRows?.[0]?.count ?? 0);

  return proposalsWithReviewAggregatesListSchema.parse({
    items,
    total,
    nextCursor,
  });
}

/**
 * Walk submitted reviews for a single proposal and tally how many times
 * each (criterionId, optionKey) pair appears. Numeric/string answers are
 * bucketed by their string representation, which matches the rubric's
 * `oneOf[].const` identifier.
 */
function computeOptionCounts(
  reviewAssignments: Array<{
    reviews: Array<{
      state: string;
      reviewData: unknown;
    }>;
  }>,
): Array<{ criterionId: string; optionKey: string; count: number }> {
  const counts: Array<{
    criterionId: string;
    optionKey: string;
    count: number;
  }> = [];

  for (const assignment of reviewAssignments) {
    for (const review of assignment.reviews) {
      if (review.state !== ProposalReviewState.SUBMITTED) {
        continue;
      }
      const data = review.reviewData as {
        answers?: Record<string, unknown>;
      } | null;
      const answers = data?.answers ?? {};
      for (const [criterionId, value] of Object.entries(answers)) {
        if (value === null || value === undefined) {
          continue;
        }
        const optionKey = String(value);
        const existing = counts.find(
          (c) => c.criterionId === criterionId && c.optionKey === optionKey,
        );
        if (existing) {
          existing.count += 1;
        } else {
          counts.push({ criterionId, optionKey, count: 1 });
        }
      }
    }
  }

  return counts;
}
