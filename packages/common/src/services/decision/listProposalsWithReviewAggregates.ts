import { and, db, eq, gt, inArray, isNull, or, sql } from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
  proposalCategories,
  proposalReviewAssignments,
  proposalReviews,
  proposals,
  taxonomyTerms,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { type SQL, count as countFn } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { z } from 'zod';

import {
  UnauthorizedError,
  decodeCursor,
  encodeCursor,
  getCursorCondition,
} from '../../utils';
import { getInstance } from './getInstance';
import { getProposalIdsForPhase } from './getProposalsForPhase';
import {
  OVERALL_RECOMMENDATION_KEY,
  getRubricScoringInfo,
} from './getRubricScoringInfo';
import { instanceOptionalPhaseRefSchema } from './schemas/instance';
import {
  IN_PROGRESS_ASSIGNMENT_STATUSES,
  PROPOSAL_REVIEW_STATUSES,
  type ProposalCategoryItem,
  type ProposalReviewStatus,
  type ProposalsWithReviewAggregatesList,
  REVIEW_ASSIGNMENT_SORTS,
  type ReviewAssignmentSort,
  proposalsWithReviewAggregatesListSchema,
} from './schemas/reviews';
import type { RubricTemplateSchema } from './types';
import { getPhaseRubricTemplate } from './utils/phaseTemplates';

// ── Input schema ───────────────────────────────────────────────────────

/**
 * Single union schema for both dispatch modes:
 *   - filtered: caller passes `proposalIds`, no pagination, no filters/sort —
 *     the caller already decided the set and its order.
 *   - paginated: phase-scoped, filterable, sortable, cursor-paginated.
 */
export const listProposalsWithReviewAggregatesInputSchema = z.union([
  instanceOptionalPhaseRefSchema.extend({
    proposalIds: z.array(z.uuid()).min(1),
  }),
  instanceOptionalPhaseRefSchema.extend({
    limit: z.number().int().min(1).max(100).default(50),
    cursor: z.string().optional(),
    /** Taxonomy term ids — keeps only proposals tagged with any of them. */
    categoryIds: z.array(z.uuid()).optional(),
    /** Keeps only proposals whose progress rollup matches. */
    reviewStatus: z.enum(PROPOSAL_REVIEW_STATUSES).optional(),
    sort: z.enum(REVIEW_ASSIGNMENT_SORTS).default('leastReviewed'),
  }),
]);

export type ListProposalsWithReviewAggregatesInput = z.infer<
  typeof listProposalsWithReviewAggregatesInputSchema
>;

// ── Public entry ───────────────────────────────────────────────────────

/**
 * Admin-only proposal list with per-proposal review aggregates. Two dispatch
 * modes determined by input shape:
 *
 *   - filtered (`proposalIds` present): caller-owned ID list, no pagination.
 *   - paginated: phase-scoped, filtered by category / review status, sorted by
 *     `sort` (default fewest completed reviews first), cursor-paginated.
 *
 * Both modes share the auth + instance + rubric setup; the split happens
 * after the admin check.
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

  const phaseId = input.phaseId ?? instance.currentStateId ?? undefined;

  // Scoring follows the effective phase's rubric (the list is always
  // phase-scoped: explicit `phaseId`, else the current phase).
  const rubricTemplate = getPhaseRubricTemplate(instance.instanceData, phaseId);
  const scoredCriterionKeys = rubricTemplate
    ? getRubricScoringInfo(rubricTemplate)
        .criteria.filter((c) => c.scored)
        .map((c) => c.key)
    : [];
  const phaseProposalIds = await getProposalIdsForPhase({
    instance,
    phaseId,
  });

  if ('proposalIds' in input) {
    return listProposalsFiltered({
      proposalIds: input.proposalIds,
      phaseProposalIds,
      processInstanceId,
      phaseId,
      scoredCriterionKeys,
      rubricTemplate,
    });
  }

  return listProposalsPaginated({
    processInstanceId,
    phaseId,
    phaseProposalIds,
    limit: input.limit,
    cursor: input.cursor,
    categoryIds: input.categoryIds,
    reviewStatus: input.reviewStatus,
    sort: input.sort,
    scoredCriterionKeys,
    rubricTemplate,
  });
}

// ── Filtered mode (caller-given proposalIds) ───────────────────────────

async function listProposalsFiltered({
  proposalIds,
  phaseProposalIds,
  processInstanceId,
  phaseId,
  scoredCriterionKeys,
  rubricTemplate,
}: {
  proposalIds: string[];
  phaseProposalIds: string[];
  processInstanceId: string;
  phaseId: string | undefined;
  scoredCriterionKeys: string[];
  rubricTemplate: RubricTemplateSchema | null;
}): Promise<ProposalsWithReviewAggregatesList> {
  const phaseProposalIdSet = new Set(phaseProposalIds);
  const filteredProposalIds = proposalIds.filter((id) =>
    phaseProposalIdSet.has(id),
  );

  if (filteredProposalIds.length === 0) {
    return { items: [], total: 0, next: null, rubricTemplate };
  }

  const [proposalsFull, categoriesByProposalId] = await Promise.all([
    db.query.proposals.findMany({
      // Defense-in-depth: getProposalsForPhase already drops detached IDs, but
      // re-apply the filter here so a bug upstream can't leak a CSAM row to
      // the review UI.
      where: {
        RAW: (table) =>
          and(
            inArray(table.id, filteredProposalIds),
            isNull(table.moderationDetachedAt),
          )!,
      },
      with: proposalRelations({ processInstanceId, phaseId }),
    }),
    getCategoriesByProposalIds(filteredProposalIds),
  ]);

  const items = proposalsFull.map((proposal) => ({
    proposal,
    aggregates: getComputedReviewAggregates(
      proposal.reviewAssignments,
      scoredCriterionKeys,
    ),
    categories: categoriesByProposalId.get(proposal.id) ?? [],
  }));

  return proposalsWithReviewAggregatesListSchema.parse({
    items,
    total: items.length,
    next: null,
    rubricTemplate,
  });
}

// ── Paginated mode (phase-scoped, cursor) ──────────────────────────────

async function listProposalsPaginated({
  processInstanceId,
  phaseId,
  phaseProposalIds,
  limit,
  cursor,
  categoryIds,
  reviewStatus,
  sort,
  scoredCriterionKeys,
  rubricTemplate,
}: {
  processInstanceId: string;
  phaseId: string | undefined;
  phaseProposalIds: string[];
  limit: number;
  cursor: string | undefined;
  categoryIds: string[] | undefined;
  reviewStatus: ProposalReviewStatus | undefined;
  sort: ReviewAssignmentSort;
  scoredCriterionKeys: string[];
  rubricTemplate: RubricTemplateSchema | null;
}): Promise<ProposalsWithReviewAggregatesList> {
  const emptyPage = { items: [], total: 0, next: null, rubricTemplate };

  if (phaseProposalIds.length === 0) {
    return emptyPage;
  }

  // Categories are resolved to an ID-set constraint (same approach as
  // listReviewAssignments) rather than a join, so the page query keeps its
  // single `proposals.id IN (…)` shape.
  const candidateProposalIds = categoryIds?.length
    ? await filterProposalIdsByCategories({
        proposalIds: phaseProposalIds,
        processInstanceId,
        categoryIds,
      })
    : phaseProposalIds;

  if (candidateProposalIds.length === 0) {
    return emptyPage;
  }

  const { completedCount, reviewStatusCondition } = reviewProgressSql({
    processInstanceId,
    phaseId,
  });

  // The rollup filter has to run in SQL: applied after the page is fetched it
  // would shrink pages below `limit` and make `total` lie.
  const statusCondition = reviewStatus
    ? reviewStatusCondition(proposals.id, reviewStatus)
    : undefined;

  const decodedCursor = cursor
    ? decodeCursor<{ value: string; id: string }>(cursor)
    : undefined;

  const [pageRowsRaw, totalRows] = await Promise.all([
    db.query.proposals.findMany({
      // Defense-in-depth: `phaseProposalIds` is already detach-filtered by
      // getProposalsForPhase, but the extra `moderationDetachedAt IS NULL`
      // guards against a future caller / bug slipping a detached ID in.
      where: {
        RAW: (table) =>
          and(
            inArray(table.id, candidateProposalIds),
            isNull(table.moderationDetachedAt),
            reviewStatus
              ? reviewStatusCondition(table.id, reviewStatus)
              : undefined,
            pageCursorCondition({
              table,
              cursor: decodedCursor,
              sort,
              completedCount,
            }),
          )!,
      },
      with: proposalRelations({ processInstanceId, phaseId }),
      orderBy: (table, { asc, desc }) => {
        if (sort === 'newest') {
          return [desc(table.createdAt), desc(table.id)];
        }
        if (sort === 'oldest') {
          return [asc(table.createdAt), asc(table.id)];
        }
        // 'leastReviewed': fewest completed reviews first. No reviewer shuffle —
        // an admin list must page deterministically.
        return [asc(completedCount(table.id)), asc(table.id)];
      },
      limit: limit + 1,
    }),
    db
      .select({ count: countFn() })
      .from(proposals)
      .where(
        and(
          inArray(proposals.id, candidateProposalIds),
          isNull(proposals.moderationDetachedAt),
          statusCondition,
        ),
      ),
  ]);

  const hasMore = pageRowsRaw.length > limit;
  const pageRows = hasMore ? pageRowsRaw.slice(0, limit) : pageRowsRaw;
  const total = Number(totalRows[0]?.count ?? 0);

  if (pageRows.length === 0) {
    return { items: [], total, next: null, rubricTemplate };
  }

  const pageIds = pageRows.map((p) => p.id);
  const categoriesByProposalId = await getCategoriesByProposalIds(pageIds);

  const items = pageRows.map((proposal) => ({
    proposal,
    aggregates: getComputedReviewAggregates(
      proposal.reviewAssignments,
      scoredCriterionKeys,
    ),
    categories: categoriesByProposalId.get(proposal.id) ?? [],
  }));

  let next: string | null = null;
  if (hasMore) {
    const lastRow = pageRows[pageRows.length - 1]!;
    next = encodeCursor<{ value: string; id: string }>({
      // The assignments relation is scoped to the same instance + phase as the
      // SQL count, so the keyset value can be read off the loaded page row.
      value:
        sort === 'leastReviewed'
          ? String(countCompletedAssignments(lastRow.reviewAssignments))
          : (lastRow.createdAt ?? ''),
      id: lastRow.id,
    });
  }

  return proposalsWithReviewAggregatesListSchema.parse({
    items,
    total,
    next,
    rubricTemplate,
  });
}

/** Keyset condition for the page query — one per sort mode. */
function pageCursorCondition({
  table,
  cursor,
  sort,
  completedCount,
}: {
  table: { createdAt: PgColumn; id: PgColumn };
  cursor: { value: string; id: string } | undefined;
  sort: ReviewAssignmentSort;
  completedCount: (proposalId: PgColumn) => SQL<number>;
}): SQL | undefined {
  if (!cursor) {
    return undefined;
  }

  if (sort === 'newest' || sort === 'oldest') {
    return getCursorCondition({
      column: table.createdAt,
      tieBreakerColumn: table.id,
      cursor,
      direction: sort === 'newest' ? 'desc' : 'asc',
    });
  }

  // 'leastReviewed' ascends over `(completedCount, id)`. The count is an
  // expression rather than a column, so the keyset is spelled out here instead
  // of going through getCursorCondition.
  const count = completedCount(table.id);
  const cursorValue = Number(cursor.value);

  return or(
    sql`${count} > ${cursorValue}`,
    and(sql`${count} = ${cursorValue}`, gt(table.id, cursor.id)),
  );
}

/** Narrows `proposalIds` to the ones tagged with any of `categoryIds`. */
async function filterProposalIdsByCategories({
  proposalIds,
  processInstanceId,
  categoryIds,
}: {
  proposalIds: string[];
  processInstanceId: string;
  categoryIds: string[];
}): Promise<string[]> {
  const rows = await db.query.proposalCategories.findMany({
    columns: { proposalId: true },
    where: {
      taxonomyTermId: { in: categoryIds },
      // Taxonomy terms are shared across instances; scope the lookup so a term
      // reused elsewhere can't widen this instance's page.
      proposal: { processInstanceId },
    },
  });

  const tagged = new Set(rows.map((row) => row.proposalId));
  return proposalIds.filter((id) => tagged.has(id));
}

/**
 * Phase-scoped review-progress SQL. Deliberately mirrors the JS rollup in
 * `getComputedReviewAggregates`, so a filtered page can never disagree with the
 * `reviewStatus` the same rows report.
 */
function reviewProgressSql({
  processInstanceId,
  phaseId,
}: {
  processInstanceId: string;
  phaseId: string | undefined;
}) {
  const phaseFilter = (alias: string) =>
    phaseId ? sql` AND ${sql.raw(alias)}.phase_id = ${phaseId}` : sql``;

  const completedCount = (proposalId: PgColumn) => sql<number>`(
    SELECT COUNT(*)::int
    FROM ${proposalReviewAssignments} AS pra_completed
    WHERE pra_completed.proposal_id = ${proposalId}
      AND pra_completed.process_instance_id = ${processInstanceId}
      AND pra_completed.status = ${ProposalReviewAssignmentStatus.COMPLETED}${phaseFilter('pra_completed')}
  )`;

  /** Someone has started but nobody has finished: an active assignment or a saved draft. */
  const startedExists = (proposalId: PgColumn) => sql<boolean>`(
    EXISTS (
      SELECT 1
      FROM ${proposalReviewAssignments} AS pra_started
      WHERE pra_started.proposal_id = ${proposalId}
        AND pra_started.process_instance_id = ${processInstanceId}
        AND (${sql.join(
          IN_PROGRESS_ASSIGNMENT_STATUSES.map(
            (status) => sql`pra_started.status = ${status}`,
          ),
          sql` OR `,
        )})${phaseFilter('pra_started')}
    )
    OR EXISTS (
      SELECT 1
      FROM ${proposalReviews} AS pr_draft
      JOIN ${proposalReviewAssignments} AS pra_draft
        ON pra_draft.id = pr_draft.assignment_id
      WHERE pra_draft.proposal_id = ${proposalId}
        AND pra_draft.process_instance_id = ${processInstanceId}
        AND pr_draft.state = ${ProposalReviewState.DRAFT}${phaseFilter('pra_draft')}
    )
  )`;

  const reviewStatusCondition = (
    proposalId: PgColumn,
    reviewStatus: ProposalReviewStatus,
  ): SQL => {
    if (reviewStatus === 'reviewed') {
      return sql`${completedCount(proposalId)} > 0`;
    }
    if (reviewStatus === 'in_progress') {
      return sql`${completedCount(proposalId)} = 0 AND ${startedExists(proposalId)}`;
    }
    return sql`${completedCount(proposalId)} = 0 AND NOT ${startedExists(proposalId)}`;
  };

  return { completedCount, reviewStatusCondition };
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * `with` block for the proposal relational query — shared by filtered and
 * paginated.
 */
export function proposalRelations({
  processInstanceId,
  phaseId,
}: {
  processInstanceId: string;
  phaseId: string | undefined;
}) {
  const assignmentWhere: Record<string, string> = { processInstanceId };
  if (phaseId) {
    assignmentWhere.phaseId = phaseId;
  }
  return {
    profile: { with: { avatarImage: true } },
    submittedBy: { with: { avatarImage: true } },
    reviewAssignments: {
      where: assignmentWhere,
      with: {
        reviewer: { with: { avatarImage: true } },
        reviews: true,
      },
    },
  } as const;
}

export async function getCategoriesByProposalIds(
  proposalIds: string[],
): Promise<Map<string, ProposalCategoryItem[]>> {
  const map = new Map<string, ProposalCategoryItem[]>();
  if (proposalIds.length === 0) {
    return map;
  }

  const rows = await db
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
    .where(inArray(proposalCategories.proposalId, proposalIds));

  for (const row of rows) {
    const list = map.get(row.proposalId) ?? [];
    list.push({ id: row.id, label: row.label, termUri: row.termUri });
    map.set(row.proposalId, list);
  }
  return map;
}

/**
 * Per-proposal review aggregates computed from the loaded review assignments.
 * Duck-typed input — only the fields the function actually reads — so callers
 * can pass the relational query result directly without a named type.
 *
 * `proposal_reviews_assignment_unique` makes `reviews` 0-or-1; we read just
 * the first row even though the relation is declared as many.
 */
export function getComputedReviewAggregates(
  reviewAssignments: Array<{
    status: string;
    reviewer: unknown;
    reviews: Array<{ state: string; reviewData: unknown }>;
  }>,
  scoredCriterionKeys: string[],
) {
  const reviewers = reviewAssignments.map((a) => ({
    profile: a.reviewer,
    status: a.status,
  }));

  let reviewsSubmittedCount = 0;
  let totalScore = 0;
  const overallRecommendationCount: Record<string, number> = {};

  for (const assignment of reviewAssignments) {
    const review = assignment.reviews[0];
    const scored = getSubmittedReviewScore(review, scoredCriterionKeys);
    if (!scored) {
      continue;
    }
    reviewsSubmittedCount += 1;
    totalScore += scored.score;

    if (scored.overallRecommendation != null) {
      const recommendation = scored.overallRecommendation;
      overallRecommendationCount[recommendation] =
        (overallRecommendationCount[recommendation] ?? 0) + 1;
    }
  }

  const averageScore =
    reviewsSubmittedCount === 0 ? 0 : totalScore / reviewsSubmittedCount;

  return {
    assignmentsCount: reviewAssignments.length,
    reviewsSubmittedCount,
    reviewStatus: getReviewStatusRollup(reviewAssignments),
    averageScore,
    overallRecommendationCount,
    reviewers,
  };
}

/** Membership test over a `string` status without asserting the union. */
const IN_PROGRESS_STATUS_SET: ReadonlySet<string> = new Set(
  IN_PROGRESS_ASSIGNMENT_STATUSES,
);

/** COMPLETED assignments — the "N Reviewed" count, and the leastReviewed key. */
function countCompletedAssignments(
  reviewAssignments: Array<{ status: string }>,
): number {
  return reviewAssignments.filter(
    (assignment) =>
      assignment.status === ProposalReviewAssignmentStatus.COMPLETED,
  ).length;
}

/**
 * The three-way progress rollup. Kept in step with `reviewProgressSql`, which
 * expresses the same rule for filtering and sorting.
 */
function getReviewStatusRollup(
  reviewAssignments: Array<{
    status: string;
    reviews: Array<{ state: string }>;
  }>,
): ProposalReviewStatus {
  if (countCompletedAssignments(reviewAssignments) > 0) {
    return 'reviewed';
  }

  const started = reviewAssignments.some(
    (assignment) =>
      IN_PROGRESS_STATUS_SET.has(assignment.status) ||
      assignment.reviews[0]?.state === ProposalReviewState.DRAFT,
  );

  return started ? 'in_progress' : 'not_started';
}

/** Returns `null` for non-submitted rows so callers can gate and score in one pass. */
export function getSubmittedReviewScore(
  review: { state: string; reviewData: unknown } | null | undefined,
  scoredCriterionKeys: string[],
): { score: number; overallRecommendation: string | null } | null {
  if (!review || review.state !== ProposalReviewState.SUBMITTED) {
    return null;
  }

  const data = review.reviewData as {
    answers?: Record<string, unknown>;
  } | null;
  const answers = data?.answers ?? {};

  let score = 0;
  for (const key of scoredCriterionKeys) {
    const value = Number(answers[key]);
    if (Number.isFinite(value)) {
      score += value;
    }
  }

  const recommendation = answers[OVERALL_RECOMMENDATION_KEY];
  const overallRecommendation =
    recommendation == null ? null : String(recommendation);

  return { score, overallRecommendation };
}
