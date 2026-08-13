import { and, db, eq, inArray, isNull, sql } from '@op/db/client';
import {
  ProposalReviewState,
  proposalCategories,
  proposalReviewAssignments,
  proposalReviews,
  proposals,
  profiles,
  taxonomyTerms,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { type SQL, count as countFn } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { z } from 'zod';

import {
  type SortDir,
  UnauthorizedError,
  decodeCursor,
  encodeCursor,
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
  type ProposalsWithReviewAggregatesList,
  proposalsWithReviewAggregatesListSchema,
} from './schemas/reviews';
import type { RubricTemplateSchema } from './types';
import { getPhaseRubricTemplate } from './utils/phaseTemplates';

// ── Input schema ───────────────────────────────────────────────────────

/**
 * One input for both dispatch modes. `proposalIds` selects the filtered mode,
 * where the caller already owns the ID list and the pagination / sort fields
 * don't apply; everything else is the phase-scoped paginated read.
 *
 * Flat rather than a union so tRPC can see `cursor` and offer the endpoint as
 * an infinite query.
 */
export const listProposalsWithReviewAggregatesInputSchema =
  instanceOptionalPhaseRefSchema.extend({
    proposalIds: z.array(z.uuid()).min(1).optional(),
    limit: z.number().int().min(1).max(100).default(50),
    cursor: z.string().nullish(),
    orderBy: z.enum(PROPOSAL_AGGREGATE_SORTS).default('createdAt'),
    dir: sortDirSchema.default('desc'),
  });

export type ListProposalsWithReviewAggregatesInput = z.infer<
  typeof listProposalsWithReviewAggregatesInputSchema
>;

// ── Public entry ───────────────────────────────────────────────────────

/**
 * Admin-only proposal list with per-proposal review aggregates. Two dispatch
 * modes:
 *
 *   - filtered (`proposalIds` present): caller-owned ID list, no pagination.
 *   - paginated: phase-scoped, sorted by any `PROPOSAL_AGGREGATE_SORTS` column
 *     (`createdAt DESC` by default), cursor-paginated.
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

  if (input.proposalIds) {
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
    cursor: input.cursor ?? undefined,
    orderBy: input.orderBy,
    dir: input.dir,
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
  // proposal query instead of after it (unlike the paginated mode).
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

// ── Paginated mode (phase-scoped, sortable, cursor) ────────────────────

async function listProposalsPaginated({
  processInstanceId,
  phaseId,
  phaseProposalIds,
  limit,
  cursor,
  orderBy,
  dir,
  scoredCriterionKeys,
  rubricTemplate,
}: {
  processInstanceId: string;
  phaseId: string | undefined;
  phaseProposalIds: string[];
  limit: number;
  cursor: string | undefined;
  orderBy: ProposalAggregateSort;
  dir: SortDir;
  scoredCriterionKeys: string[];
  rubricTemplate: RubricTemplateSchema | null;
}): Promise<ProposalsWithReviewAggregatesList> {
  if (phaseProposalIds.length === 0) {
    return { items: [], total: 0, next: null, rubricTemplate };
  }

  const decodedCursor = cursor
    ? decodeCursor<{ value: string; id: string }>(cursor)
    : undefined;

  // One expression drives ORDER BY, the cursor condition, and the value that
  // gets encoded into the next cursor, so the three can't disagree.
  const sortExpression = (table: ProposalsTable) =>
    buildSortExpression({
      table,
      orderBy,
      processInstanceId,
      phaseId,
      scoredCriterionKeys,
    });

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
            buildCursorCondition({
              sortValue: sortExpression(table),
              tieBreaker: table.id,
              orderBy,
              dir,
              cursor: decodedCursor,
            }),
          )!,
      },
      with: proposalRelations({ processInstanceId, phaseId }),
      // Read the sort key back from the database rather than recomputing it in
      // JS — the next cursor is then compared against the exact value Postgres
      // ordered by, down to numeric precision.
      extras: {
        sortValue: (table) => sortExpression(table).as('sort_value'),
      },
      orderBy: (table, { asc: ascOp, desc: descOp }) => {
        // `id` tie-break: rows sharing a sort key (a score of 0, a missing
        // budget) would otherwise come back in undefined order, which breaks
        // keyset pagination.
        const directional = dir === 'asc' ? ascOp : descOp;
        return [directional(sortExpression(table)), directional(table.id)];
      },
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
      value: String(lastRow.sortValue),
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

// ── Sort expressions ───────────────────────────────────────────────────

type ProposalsTable = typeof proposals;

/**
 * Guards the `::numeric` casts below: JSON holds these values as free text, and
 * a cast of anything non-numeric raises rather than returning null. Matches the
 * forms `Number()` accepts on the JS side (integer, decimal, exponent).
 */
const NUMERIC_TEXT_PATTERN = '^[+-]?[0-9]+(\\.[0-9]+)?([eE][+-]?[0-9]+)?$';

/** Postgres type each sort key is compared as when a cursor is decoded. */
const SORT_VALUE_CASTS: Record<ProposalAggregateSort, SQL> = {
  createdAt: sql`timestamptz`,
  title: sql`text`,
  budget: sql`numeric`,
  score: sql`numeric`,
};

/**
 * The sortable columns of the review-selection table, as SQL.
 *
 * `title`, `budget` and `score` aren't columns on `proposals` — they live on
 * the proposal's profile, inside `proposalData`, and across the phase's
 * submitted reviews respectively. Each expression coalesces to a non-null
 * value so a missing budget or an unreviewed proposal still keysets cleanly
 * (`NULL` would drop the row from the cursor comparison entirely).
 */
function buildSortExpression({
  table,
  orderBy,
  processInstanceId,
  phaseId,
  scoredCriterionKeys,
}: {
  table: ProposalsTable;
  orderBy: ProposalAggregateSort;
  processInstanceId: string;
  phaseId: string | undefined;
  scoredCriterionKeys: string[];
}): SQL {
  switch (orderBy) {
    case 'title':
      return sql`COALESCE((
        SELECT ${profiles.name} FROM ${profiles}
        WHERE ${profiles.id} = ${table.profileId}
      ), '')`;
    case 'budget':
      return buildBudgetAmountExpression(table);
    case 'score':
      return buildAverageScoreExpression({
        table,
        processInstanceId,
        phaseId,
        scoredCriterionKeys,
      });
    case 'createdAt':
      return sql`${table.createdAt}`;
  }
}

/**
 * Budget as a number, reading both the canonical `{ amount, currency }` shape
 * and the legacy bare-number form (see `budgetValueSchema`). Anything
 * unparseable — including no budget at all — sorts as 0.
 */
function buildBudgetAmountExpression(table: ProposalsTable): SQL {
  return sql`(
    SELECT CASE
      WHEN raw.value ~ ${NUMERIC_TEXT_PATTERN} THEN raw.value::numeric
      ELSE 0
    END
    FROM (
      SELECT CASE
        WHEN jsonb_typeof(${table.proposalData}->'budget') = 'object'
          THEN ${table.proposalData}->'budget'->>'amount'
        ELSE ${table.proposalData}->>'budget'
      END AS value
    ) raw
  )`;
}

/**
 * Mean of the per-review scores across the phase's submitted reviews — the SQL
 * twin of `getComputedReviewAggregates`: sum the scored criteria of each
 * submitted review, average across reviews, 0 when nothing is submitted.
 * Non-numeric answers contribute 0, matching the `Number.isFinite` guard in
 * `getSubmittedReviewScore`.
 */
function buildAverageScoreExpression({
  table,
  processInstanceId,
  phaseId,
  scoredCriterionKeys,
}: {
  table: ProposalsTable;
  processInstanceId: string;
  phaseId: string | undefined;
  scoredCriterionKeys: string[];
}): SQL {
  const criterionKeys =
    scoredCriterionKeys.length === 0
      ? sql`ARRAY[]::text[]`
      : sql`ARRAY[${sql.join(
          scoredCriterionKeys.map((key) => sql`${key}`),
          sql`, `,
        )}]::text[]`;

  return sql`COALESCE((
    SELECT AVG(submitted.total)
    FROM ${proposalReviewAssignments} assignment
    INNER JOIN ${proposalReviews} review
      ON review.assignment_id = assignment.id
      AND review.state = ${ProposalReviewState.SUBMITTED}
    CROSS JOIN LATERAL (
      SELECT COALESCE(SUM(
        CASE
          WHEN review.review_data->'answers'->>criterion ~ ${NUMERIC_TEXT_PATTERN}
            THEN (review.review_data->'answers'->>criterion)::numeric
          ELSE 0
        END
      ), 0) AS total
      FROM unnest(${criterionKeys}) AS criterion
    ) submitted
    WHERE assignment.proposal_id = ${table.id}
      AND assignment.process_instance_id = ${processInstanceId}
      ${phaseId ? sql`AND assignment.phase_id = ${phaseId}` : sql``}
  ), 0)`;
}

/**
 * Keyset condition over the same expression the query orders by: everything
 * strictly past the cursor's `(sortValue, id)`.
 */
function buildCursorCondition({
  sortValue,
  tieBreaker,
  orderBy,
  dir,
  cursor,
}: {
  sortValue: SQL;
  tieBreaker: PgColumn;
  orderBy: ProposalAggregateSort;
  dir: SortDir;
  cursor: { value: string; id: string } | undefined;
}): SQL | undefined {
  if (!cursor) {
    return undefined;
  }

  const compare = dir === 'asc' ? sql`>` : sql`<`;
  const cursorValue = sql`${cursor.value}::${SORT_VALUE_CASTS[orderBy]}`;

  return sql`(
    ${sortValue} ${compare} ${cursorValue}
    OR (${sortValue} = ${cursorValue} AND ${tieBreaker} ${compare} ${cursor.id})
  )`;
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
