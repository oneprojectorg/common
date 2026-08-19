import { and, db, eq, inArray, isNull } from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
  proposalCategories,
  proposals,
  taxonomyTerms,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { count as countFn } from 'drizzle-orm';
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
  type ProposalCategoryItem,
  type ProposalReviewStatus,
  type ProposalsWithReviewAggregatesList,
  proposalsWithReviewAggregatesListSchema,
} from './schemas/reviews';
import type { RubricTemplateSchema } from './types';
import { getPhaseRubricTemplate } from './utils/phaseTemplates';

// ── Input schema ───────────────────────────────────────────────────────

/**
 * Single union schema for both dispatch modes:
 *   - filtered: caller passes `proposalIds`, no pagination.
 *   - paginated: phase-scoped, cursor-paginated.
 */
export const listProposalsWithReviewAggregatesInputSchema = z.union([
  instanceOptionalPhaseRefSchema.extend({
    proposalIds: z.array(z.uuid()).min(1),
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
 * Admin-only proposal list with per-proposal review aggregates. Two dispatch
 * modes determined by input shape:
 *
 *   - filtered (`proposalIds` present): caller-owned ID list, no pagination.
 *   - paginated: phase-scoped, `createdAt DESC`, cursor-paginated.
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

/**
 * The three-way progress rollup: any COMPLETED assignment means reviewed;
 * otherwise an active assignment or a saved draft means someone has started.
 */
function getReviewStatusRollup(
  reviewAssignments: Array<{
    status: string;
    reviews: Array<{ state: string }>;
  }>,
): ProposalReviewStatus {
  const completed = reviewAssignments.some(
    (assignment) =>
      assignment.status === ProposalReviewAssignmentStatus.COMPLETED,
  );
  if (completed) {
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
