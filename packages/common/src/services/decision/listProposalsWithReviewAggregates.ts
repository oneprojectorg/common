import { and, db, eq, inArray, isNull } from '@op/db/client';
import {
  ProposalReviewState,
  proposalCategories,
  proposals,
  taxonomyTerms,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { count as countFn } from 'drizzle-orm';
import { z } from 'zod';

import {
  type SortDir,
  UnauthorizedError,
  decodeCursor,
  encodeCursor,
  getCursorCondition,
  sortDirSchema,
} from '../../utils';
import { getInstance } from './getInstance';
import { getProposalIdsForPhase } from './getProposalsForPhase';
import {
  OVERALL_RECOMMENDATION_KEY,
  getRubricScoringInfo,
} from './getRubricScoringInfo';
import { instanceOptionalPhaseRefSchema } from './schemas/instance';
import {
  PROPOSAL_AGGREGATE_SORTS,
  type ProposalAggregateSort,
  type ProposalCategoryItem,
  type ProposalWithAggregates,
  type ProposalsWithReviewAggregatesList,
  proposalsWithReviewAggregatesListSchema,
} from './schemas/reviews';
import type { RubricTemplateSchema } from './types';
import { getPhaseRubricTemplate } from './utils/phaseTemplates';

// ── Input schema ───────────────────────────────────────────────────────

/**
 * Single union schema for the three dispatch modes:
 *   - filtered: caller passes `proposalIds`, no pagination.
 *   - sorted: caller passes `orderBy`, whole phase set in one page.
 *   - paginated: phase-scoped, cursor-paginated.
 *
 * Union order matters — the paginated member's fields are all optional, so it
 * would otherwise swallow a sorted request.
 */
export const listProposalsWithReviewAggregatesInputSchema = z.union([
  instanceOptionalPhaseRefSchema.extend({
    proposalIds: z.array(z.uuid()).min(1),
  }),
  instanceOptionalPhaseRefSchema.extend({
    orderBy: z.enum(PROPOSAL_AGGREGATE_SORTS),
    dir: sortDirSchema.default('desc'),
  }),
  instanceOptionalPhaseRefSchema.extend({
    limit: z.number().int().min(1).max(100).default(50),
    cursor: z.string().optional(),
  }),
]);

export type ListProposalsWithReviewAggregatesInput = z.infer<
  typeof listProposalsWithReviewAggregatesInputSchema
>;

// ── Public entry ───────────────────────────────────────────────────────

/**
 * Admin-only proposal list with per-proposal review aggregates. Three dispatch
 * modes determined by input shape:
 *
 *   - filtered (`proposalIds` present): caller-owned ID list, no pagination.
 *   - sorted (`orderBy` present): whole phase set ordered by a derived value,
 *     returned as a single page.
 *   - paginated: phase-scoped, `createdAt DESC`, cursor-paginated.
 *
 * All modes share the auth + instance + rubric setup; the split happens
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

  if ('orderBy' in input) {
    return listProposalsSorted({
      processInstanceId,
      phaseId,
      phaseProposalIds,
      orderBy: input.orderBy,
      dir: input.dir,
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

  // The IDs are known up front here, so the categories read runs alongside the
  // proposal query instead of after it (unlike the paginated / sorted modes).
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

  const items = proposalsFull.map((proposal) =>
    toItem({ proposal, categoriesByProposalId, scoredCriterionKeys }),
  );

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
  scoredCriterionKeys,
  rubricTemplate,
}: {
  processInstanceId: string;
  phaseId: string | undefined;
  phaseProposalIds: string[];
  limit: number;
  cursor: string | undefined;
  scoredCriterionKeys: string[];
  rubricTemplate: RubricTemplateSchema | null;
}): Promise<ProposalsWithReviewAggregatesList> {
  if (phaseProposalIds.length === 0) {
    return { items: [], total: 0, next: null, rubricTemplate };
  }

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
            inArray(table.id, phaseProposalIds),
            isNull(table.moderationDetachedAt),
            decodedCursor
              ? getCursorCondition({
                  column: table.createdAt,
                  tieBreakerColumn: table.id,
                  cursor: decodedCursor,
                  direction: 'desc',
                })
              : undefined,
          )!,
      },
      with: proposalRelations({ processInstanceId, phaseId }),
      orderBy: { createdAt: 'desc', id: 'desc' },
      limit: limit + 1,
    }),
    db
      .select({ count: countFn() })
      .from(proposals)
      .where(
        and(
          inArray(proposals.id, phaseProposalIds),
          isNull(proposals.moderationDetachedAt),
        ),
      ),
  ]);

  const hasMore = pageRowsRaw.length > limit;
  const pageRows = hasMore ? pageRowsRaw.slice(0, limit) : pageRowsRaw;
  const total = Number(totalRows[0]?.count ?? 0);

  if (pageRows.length === 0) {
    return { items: [], total, next: null, rubricTemplate };
  }

  const items = await buildItems({ rows: pageRows, scoredCriterionKeys });

  let next: string | null = null;
  if (hasMore) {
    const lastRow = pageRows[pageRows.length - 1]!;
    next = encodeCursor<{ value: string; id: string }>({
      value: lastRow.createdAt ?? '',
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

// ── Sorted mode (whole phase set, one page) ────────────────────────────

/**
 * Phase-scoped list ordered by one of the review-selection table's columns.
 *
 * Ordering happens in memory over the *complete* phase set rather than in SQL:
 * `score` is derived from rubric answers stored as JSON, so ordering it in the
 * database would mean re-implementing `getComputedReviewAggregates` in SQL and
 * risking a sort key that disagrees with the score rendered in the cell. The
 * whole set is loaded and returned as a single page (`next: null`) so the
 * order covers every proposal instead of just the rows on one keyset page —
 * the same trade-off `listProposals` makes for its computed `votes` sort.
 */
async function listProposalsSorted({
  processInstanceId,
  phaseId,
  phaseProposalIds,
  orderBy,
  dir,
  scoredCriterionKeys,
  rubricTemplate,
}: {
  processInstanceId: string;
  phaseId: string | undefined;
  phaseProposalIds: string[];
  orderBy: ProposalAggregateSort;
  dir: SortDir;
  scoredCriterionKeys: string[];
  rubricTemplate: RubricTemplateSchema | null;
}): Promise<ProposalsWithReviewAggregatesList> {
  if (phaseProposalIds.length === 0) {
    return { items: [], total: 0, next: null, rubricTemplate };
  }

  const rows = await db.query.proposals.findMany({
    // Defense-in-depth: `phaseProposalIds` is already detach-filtered by
    // getProposalsForPhase (see the paginated mode for the same guard).
    where: {
      RAW: (table) =>
        and(
          inArray(table.id, phaseProposalIds),
          isNull(table.moderationDetachedAt),
        )!,
    },
    with: proposalRelations({ processInstanceId, phaseId }),
  });

  const items = await buildItems({ rows, scoredCriterionKeys });

  // Parse before sorting so the comparators read the encoded shape — notably
  // `proposalData.budget` normalized to `{ amount, currency }`.
  const parsed = proposalsWithReviewAggregatesListSchema.parse({
    items,
    total: items.length,
    next: null,
    rubricTemplate,
  });

  return { ...parsed, items: sortItems(parsed.items, orderBy, dir) };
}

/** Sort key per column; `null` for rows the column has no value for. */
const SORT_VALUES: Record<
  ProposalAggregateSort,
  (item: ProposalWithAggregates) => string | number | null
> = {
  createdAt: (item) => item.proposal.createdAt ?? null,
  title: (item) => item.proposal.profile.name,
  budget: (item) => item.proposal.proposalData.budget?.amount ?? null,
  score: (item) => item.aggregates.averageScore,
};

function sortItems(
  items: Array<ProposalWithAggregates>,
  orderBy: ProposalAggregateSort,
  dir: SortDir,
): Array<ProposalWithAggregates> {
  const sortValue = SORT_VALUES[orderBy];
  const direction = dir === 'asc' ? 1 : -1;

  return [...items].sort((left, right) => {
    const leftValue = sortValue(left);
    const rightValue = sortValue(right);

    // Rows without a value (no budget, no timestamp) sort last in both
    // directions — flipping the header reorders the real values instead of
    // paging the blanks to the top.
    if (leftValue === null || rightValue === null) {
      if (leftValue === rightValue) {
        return compareTieBreak(left, right);
      }
      return leftValue === null ? 1 : -1;
    }

    const delta =
      typeof leftValue === 'string' || typeof rightValue === 'string'
        ? String(leftValue).localeCompare(String(rightValue))
        : leftValue - rightValue;

    return delta === 0
      ? compareTieBreak(left, right)
      : direction * Math.sign(delta);
  });
}

/**
 * Newest first, then id — direction-independent so equal sort keys keep a
 * stable order when the admin toggles a column.
 */
function compareTieBreak(
  left: ProposalWithAggregates,
  right: ProposalWithAggregates,
): number {
  const byCreatedAt = (right.proposal.createdAt ?? '').localeCompare(
    left.proposal.createdAt ?? '',
  );
  return byCreatedAt !== 0
    ? byCreatedAt
    : left.proposal.id.localeCompare(right.proposal.id);
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Decorates loaded proposal rows with their review aggregates + categories.
 * The categories read only knows which IDs to fetch once the rows are in, so
 * callers that know their IDs up front should parallelize it themselves (see
 * the filtered mode) and map with `toItem`.
 */
async function buildItems<Row extends ProposalRowForItem>({
  rows,
  scoredCriterionKeys,
}: {
  rows: Array<Row>;
  scoredCriterionKeys: string[];
}) {
  const categoriesByProposalId = await getCategoriesByProposalIds(
    rows.map((row) => row.id),
  );

  return rows.map((proposal) =>
    toItem({ proposal, categoriesByProposalId, scoredCriterionKeys }),
  );
}

/** Only the fields the aggregates + categories decoration reads. */
type ProposalRowForItem = {
  id: string;
  reviewAssignments: Array<{
    status: string;
    reviewer: unknown;
    reviews: Array<{ state: string; reviewData: unknown }>;
  }>;
};

function toItem<Row extends ProposalRowForItem>({
  proposal,
  categoriesByProposalId,
  scoredCriterionKeys,
}: {
  proposal: Row;
  categoriesByProposalId: Map<string, ProposalCategoryItem[]>;
  scoredCriterionKeys: string[];
}) {
  return {
    proposal,
    aggregates: getComputedReviewAggregates(
      proposal.reviewAssignments,
      scoredCriterionKeys,
    ),
    categories: categoriesByProposalId.get(proposal.id) ?? [],
  };
}

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
    averageScore,
    overallRecommendationCount,
    reviewers,
  };
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
