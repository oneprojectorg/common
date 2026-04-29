import { db, eq, inArray } from '@op/db/client';
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
import {
  type ProposalCategoryItem,
  type ProposalsWithReviewAggregatesList,
  proposalsWithReviewAggregatesListSchema,
} from './schemas/reviews';

// ── Input schema ───────────────────────────────────────────────────────

/**
 * Single union schema for both dispatch modes:
 *   - filtered: caller passes `proposalIds`, no pagination.
 *   - paginated: phase-scoped, cursor-paginated.
 */
export const listProposalsWithReviewAggregatesInputSchema = z.union([
  z.object({
    processInstanceId: z.uuid(),
    phaseId: z.string().optional(),
    proposalIds: z.array(z.uuid()).min(1),
  }),
  z.object({
    processInstanceId: z.uuid(),
    phaseId: z.string().optional(),
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

  const rubricTemplate = instance.instanceData.rubricTemplate;
  const scoredCriterionKeys = rubricTemplate
    ? getRubricScoringInfo(rubricTemplate)
        .criteria.filter((c) => c.scored)
        .map((c) => c.key)
    : [];

  const phaseId = input.phaseId ?? instance.currentStateId ?? undefined;
  const phaseProposalIds = await getProposalIdsForPhase({
    instanceId: processInstanceId,
    phaseId,
  });

  if ('proposalIds' in input) {
    return listProposalsFiltered({
      proposalIds: input.proposalIds,
      phaseProposalIds,
      processInstanceId,
      phaseId,
      scoredCriterionKeys,
    });
  }

  return listProposalsPaginated({
    processInstanceId,
    phaseId,
    phaseProposalIds,
    limit: input.limit,
    cursor: input.cursor,
    scoredCriterionKeys,
  });
}

// ── Filtered mode (caller-given proposalIds) ───────────────────────────

async function listProposalsFiltered({
  proposalIds,
  phaseProposalIds,
  processInstanceId,
  phaseId,
  scoredCriterionKeys,
}: {
  proposalIds: string[];
  phaseProposalIds: string[];
  processInstanceId: string;
  phaseId: string | undefined;
  scoredCriterionKeys: string[];
}): Promise<ProposalsWithReviewAggregatesList> {
  const phaseProposalIdSet = new Set(phaseProposalIds);
  const filteredProposalIds = proposalIds.filter((id) =>
    phaseProposalIdSet.has(id),
  );

  if (filteredProposalIds.length === 0) {
    return { items: [], total: 0, next: null };
  }

  const [proposalsFull, categoriesByProposalId] = await Promise.all([
    db.query.proposals.findMany({
      where: { id: { in: filteredProposalIds } },
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
}: {
  processInstanceId: string;
  phaseId: string | undefined;
  phaseProposalIds: string[];
  limit: number;
  cursor: string | undefined;
  scoredCriterionKeys: string[];
}): Promise<ProposalsWithReviewAggregatesList> {
  if (phaseProposalIds.length === 0) {
    return { items: [], total: 0, next: null };
  }

  const decodedCursor = cursor
    ? decodeCursor<{ value: string; id: string }>(cursor)
    : undefined;

  const [pageRowsRaw, totalRows] = await Promise.all([
    db.query.proposals.findMany({
      where: {
        id: { in: phaseProposalIds },
        ...(decodedCursor && {
          RAW: (table) =>
            getCursorCondition({
              column: table.createdAt,
              tieBreakerColumn: table.id,
              cursor: decodedCursor,
              direction: 'desc',
            }),
        }),
      },
      with: proposalRelations({ processInstanceId, phaseId }),
      orderBy: { createdAt: 'desc', id: 'desc' },
      limit: limit + 1,
    }),
    db
      .select({ count: countFn() })
      .from(proposals)
      .where(inArray(proposals.id, phaseProposalIds)),
  ]);

  const hasMore = pageRowsRaw.length > limit;
  const pageRows = hasMore ? pageRowsRaw.slice(0, limit) : pageRowsRaw;
  const total = Number(totalRows[0]?.count ?? 0);

  if (pageRows.length === 0) {
    return { items: [], total, next: null };
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
  });
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * `with` block for the proposal relational query — shared by filtered and
 * paginated.
 */
function proposalRelations({
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

async function getCategoriesByProposalIds(
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
function getComputedReviewAggregates(
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
    if (!review || review.state !== ProposalReviewState.SUBMITTED) {
      continue;
    }
    reviewsSubmittedCount += 1;

    const data = review.reviewData as {
      answers?: Record<string, unknown>;
    } | null;
    const answers = data?.answers ?? {};

    for (const key of scoredCriterionKeys) {
      const value = Number(answers[key]);
      if (Number.isFinite(value)) {
        totalScore += value;
      }
    }

    const recommendation = answers[OVERALL_RECOMMENDATION_KEY];
    if (recommendation != null) {
      const recommendationKey = String(recommendation);
      overallRecommendationCount[recommendationKey] =
        (overallRecommendationCount[recommendationKey] ?? 0) + 1;
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
