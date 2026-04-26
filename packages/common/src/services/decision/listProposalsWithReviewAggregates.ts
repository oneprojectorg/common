import { and, asc, db, desc, eq, inArray, ne, or, sql } from '@op/db/client';
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
  type ProposalsWithReviewAggregatesHydration,
  type ProposalsWithReviewAggregatesPaginated,
  proposalsWithReviewAggregatesHydrationSchema,
  proposalsWithReviewAggregatesPaginatedSchema,
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

const isHydrationInput = (
  input: ListProposalsWithReviewAggregatesInput,
): input is HydrationInput => 'proposalIds' in input;

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
 * `optionKey` in `optionCounts` are the rubric property keys, which the
 * client resolves to human labels.
 */
export async function listProposalsWithReviewAggregates(
  input: ListProposalsWithReviewAggregatesInput & { user: User },
): Promise<
  | ProposalsWithReviewAggregatesHydration
  | ProposalsWithReviewAggregatesPaginated
> {
  const { user, processInstanceId } = input;

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

  const proposalSelect = {
    id: proposals.id,
    processInstanceId: proposals.processInstanceId,
    proposalData: proposals.proposalData,
    status: proposals.status,
    visibility: proposals.visibility,
    profileId: proposals.profileId,
    submittedByProfileId: proposals.submittedByProfileId,
    createdAt: proposals.createdAt,
    updatedAt: proposals.updatedAt,
    assignmentsTotal: sql<number>`COALESCE(${aggSubquery.assignmentsTotal}, 0)::int`,
    reviewsSubmitted: sql<number>`COALESCE(${aggSubquery.reviewsSubmitted}, 0)::int`,
    totalScore: sql<number>`COALESCE(${aggSubquery.totalScore}, 0)::numeric`,
    averageScore: sql<number>`COALESCE(${aggSubquery.averageScore}, 0)::numeric`,
  };

  if (isHydrationInput(input)) {
    // proposalIds outside the instance are silently dropped by the
    // processInstanceId filter — defense-in-depth on top of the admin gate.
    const proposalRows = await db
      .select(proposalSelect)
      .from(proposals)
      .leftJoin(aggSubquery, eq(aggSubquery.proposalId, proposals.id))
      .where(
        and(
          eq(proposals.processInstanceId, processInstanceId),
          ne(proposals.status, ProposalStatus.DRAFT),
          inArray(proposals.id, input.proposalIds),
        ),
      );

    const items = await assembleItems({
      processInstanceId,
      proposalRows,
    });

    return proposalsWithReviewAggregatesHydrationSchema.parse({ items });
  }

  // Paginated mode
  const {
    categoryId,
    status,
    sortBy = 'createdAt',
    dir = 'desc',
    limit = 50,
    cursor,
  } = input;

  // Pre-resolve the proposal IDs for `categoryId` filtering. Doing it as a
  // separate query (rather than a nested join) keeps the aggregation query
  // simple and avoids accidentally multiplying rows when a proposal has
  // multiple categories.
  let categoryProposalIds: string[] | null = null;
  if (categoryId) {
    const categoryRows = await db
      .select({ proposalId: proposalCategories.proposalId })
      .from(proposalCategories)
      .where(eq(proposalCategories.taxonomyTermId, categoryId));
    categoryProposalIds = categoryRows.map((r) => r.proposalId);
    if (categoryProposalIds.length === 0) {
      return { items: [], total: 0, nextCursor: null };
    }
  }

  // Pre-resolve the proposal IDs that have at least one assignment matching
  // the optional `status` filter. This filters which proposals appear; the
  // computed aggregates still reflect the full assignment roster.
  let statusFilteredProposalIds: string[] | null = null;
  if (status) {
    const statusRows = await db
      .selectDistinct({ proposalId: proposalReviewAssignments.proposalId })
      .from(proposalReviewAssignments)
      .where(
        and(
          eq(proposalReviewAssignments.processInstanceId, processInstanceId),
          eq(proposalReviewAssignments.status, status),
        ),
      );
    statusFilteredProposalIds = statusRows.map((r) => r.proposalId);
    if (statusFilteredProposalIds.length === 0) {
      return { items: [], total: 0, nextCursor: null };
    }
  }

  const sortColumnExpr =
    sortBy === 'totalScore'
      ? sql<number>`COALESCE(${aggSubquery.totalScore}, 0)`
      : sortBy === 'averageScore'
        ? sql<number>`COALESCE(${aggSubquery.averageScore}, 0)`
        : sortBy === 'reviewsSubmitted'
          ? sql<number>`COALESCE(${aggSubquery.reviewsSubmitted}, 0)`
          : proposals.createdAt;

  const decodedCursor = cursor
    ? decodeCursor<AggregatesCursor>(cursor)
    : undefined;

  const cursorCondition = (() => {
    if (!decodedCursor) {
      return undefined;
    }
    const cmp = dir === 'asc' ? sql`>` : sql`<`;
    return or(
      sql`${sortColumnExpr} ${cmp} ${decodedCursor.value}`,
      and(
        sql`${sortColumnExpr} = ${decodedCursor.value}`,
        sql`${proposals.id} ${cmp} ${decodedCursor.id}`,
      ),
    );
  })();

  const orderFn = dir === 'asc' ? asc : desc;

  // `baseConditions` defines the candidate set (used by both the page query
  // and the total-count query). The cursor is page-only — it must NOT
  // participate in `total`, since `total` describes the full filtered set.
  const baseConditions = [
    eq(proposals.processInstanceId, processInstanceId),
    ne(proposals.status, ProposalStatus.DRAFT),
  ];
  if (categoryProposalIds) {
    baseConditions.push(inArray(proposals.id, categoryProposalIds));
  }
  if (statusFilteredProposalIds) {
    baseConditions.push(inArray(proposals.id, statusFilteredProposalIds));
  }

  const pageConditions = [...baseConditions];
  if (cursorCondition) {
    pageConditions.push(cursorCondition);
  }

  const [proposalRows, totalRows] = await Promise.all([
    db
      .select(proposalSelect)
      .from(proposals)
      .leftJoin(aggSubquery, eq(aggSubquery.proposalId, proposals.id))
      .where(and(...pageConditions))
      .orderBy(orderFn(sortColumnExpr), orderFn(proposals.id))
      .limit(limit + 1),
    db
      .select({ count: countFn() })
      .from(proposals)
      .where(and(...baseConditions)),
  ]);
  const total = Number(totalRows[0]?.count ?? 0);

  const hasMore = proposalRows.length > limit;
  const pageRows = hasMore ? proposalRows.slice(0, limit) : proposalRows;

  const items = await assembleItems({
    processInstanceId,
    proposalRows: pageRows,
  });

  let nextCursor: string | null = null;
  if (hasMore) {
    const lastRow = pageRows[pageRows.length - 1];
    if (lastRow) {
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
  }

  return proposalsWithReviewAggregatesPaginatedSchema.parse({
    items,
    total,
    nextCursor,
  });
}

/**
 * Loads the per-page side data (profiles, reviewer roster, submitted reviews
 * for option-count tallies, attached categories) and assembles the response
 * items. Shared between hydration and paginated modes — the candidate set
 * differs but the assembly logic is identical.
 */
async function assembleItems({
  processInstanceId,
  proposalRows,
}: {
  processInstanceId: string;
  proposalRows: Array<{
    id: string;
    processInstanceId: string;
    proposalData: unknown;
    status: string | null;
    visibility: string;
    profileId: string;
    submittedByProfileId: string;
    createdAt: string | null;
    updatedAt: string | null;
    assignmentsTotal: number;
    reviewsSubmitted: number;
    totalScore: number;
    averageScore: number;
  }>;
}) {
  if (proposalRows.length === 0) {
    return [];
  }

  const proposalIds = proposalRows.map((p) => p.id);
  const profileIdsToLoad = Array.from(
    new Set([
      ...proposalRows.map((p) => p.profileId),
      ...proposalRows.map((p) => p.submittedByProfileId),
    ]),
  );

  const [
    profileRows,
    reviewerAssignmentRows,
    submittedReviewRows,
    categoryRows,
  ] = await Promise.all([
    db.query.profiles.findMany({
      where: { id: { in: profileIdsToLoad } },
      with: { avatarImage: true },
    }),
    db.query.proposalReviewAssignments.findMany({
      where: {
        processInstanceId,
        proposalId: { in: proposalIds },
      },
      with: {
        reviewer: {
          with: { avatarImage: true },
        },
      },
    }),
    db
      .select({
        proposalId: proposalReviewAssignments.proposalId,
        reviewData: proposalReviews.reviewData,
      })
      .from(proposalReviews)
      .innerJoin(
        proposalReviewAssignments,
        eq(proposalReviewAssignments.id, proposalReviews.assignmentId),
      )
      .where(
        and(
          eq(proposalReviewAssignments.processInstanceId, processInstanceId),
          inArray(proposalReviewAssignments.proposalId, proposalIds),
          eq(proposalReviews.state, ProposalReviewState.SUBMITTED),
        ),
      ),
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
      .where(inArray(proposalCategories.proposalId, proposalIds)),
  ]);

  const profilesById = new Map(profileRows.map((p) => [p.id, p]));

  type ReviewerEntry = {
    profile: (typeof reviewerAssignmentRows)[number]['reviewer'];
    status: (typeof reviewerAssignmentRows)[number]['status'];
  };
  const reviewersByProposalId = new Map<string, ReviewerEntry[]>();
  for (const row of reviewerAssignmentRows) {
    const list = reviewersByProposalId.get(row.proposalId) ?? [];
    list.push({ profile: row.reviewer, status: row.status });
    reviewersByProposalId.set(row.proposalId, list);
  }

  // Tally option counts per (proposalId, criterionKey, optionValue) by
  // walking each submitted review's `answers` map. Numeric / string answers
  // are bucketed by their string representation, which matches the rubric's
  // `oneOf[].const` identifier.
  type OptionCount = {
    criterionId: string;
    optionKey: string;
    count: number;
  };
  const optionCountsByProposalId = new Map<string, OptionCount[]>();

  for (const row of submittedReviewRows) {
    const data = row.reviewData as { answers?: Record<string, unknown> } | null;
    const answers = data?.answers ?? {};
    let bucket = optionCountsByProposalId.get(row.proposalId);
    if (!bucket) {
      bucket = [];
      optionCountsByProposalId.set(row.proposalId, bucket);
    }
    for (const [criterionId, value] of Object.entries(answers)) {
      if (value === null || value === undefined) {
        continue;
      }
      const optionKey = String(value);
      const existing = bucket.find(
        (b) => b.criterionId === criterionId && b.optionKey === optionKey,
      );
      if (existing) {
        existing.count += 1;
      } else {
        bucket.push({ criterionId, optionKey, count: 1 });
      }
    }
  }

  type CategoryEntry = { id: string; label: string; termUri: string };
  const categoriesByProposalId = new Map<string, CategoryEntry[]>();
  for (const row of categoryRows) {
    const list = categoriesByProposalId.get(row.proposalId) ?? [];
    list.push({ id: row.id, label: row.label, termUri: row.termUri });
    categoriesByProposalId.set(row.proposalId, list);
  }

  return proposalRows.map((row) => {
    const profile = profilesById.get(row.profileId);
    const submittedBy = profilesById.get(row.submittedByProfileId);
    const reviewers = reviewersByProposalId.get(row.id) ?? [];
    const optionCounts = optionCountsByProposalId.get(row.id) ?? [];
    const categories = categoriesByProposalId.get(row.id) ?? [];

    return {
      id: row.id,
      processInstanceId: row.processInstanceId,
      proposalData: parseProposalData(row.proposalData),
      status: row.status,
      visibility: row.visibility,
      profileId: row.profileId,
      profile,
      submittedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      aggregates: {
        assignmentsTotal: Number(row.assignmentsTotal),
        reviewsSubmitted: Number(row.reviewsSubmitted),
        totalScore: Number(row.totalScore),
        averageScore: Number(row.averageScore),
        optionCounts,
        reviewers,
      },
      categories,
    };
  });
}
