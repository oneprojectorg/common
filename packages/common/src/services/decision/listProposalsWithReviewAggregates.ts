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
import { parseProposalData } from './proposalDataSchema';
import {
  type ProposalCategoryItem,
  type ProposalsWithReviewAggregatesList,
  proposalsWithReviewAggregatesListSchema,
} from './schemas/reviews';
import type { RubricTemplateSchema } from './types';

// ── Input schema ───────────────────────────────────────────────────────

/**
 * Single union schema for both dispatch modes:
 *   - filtered: caller passes `proposalIds`, no pagination.
 *   - paginated: phase-scoped, cursor-paginated.
 *
 * Shared fields (`processInstanceId`, `phaseId`) are repeated so each
 * variant of the union is a complete shape Zod can discriminate by
 * presence of `proposalIds`.
 */
export const listProposalsWithReviewAggregatesInputSchema = z.union([
  z.object({
    processInstanceId: z.uuid(),
    phaseId: z.string().optional(),
    proposalIds: z.array(z.uuid()).min(1).max(200),
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

type AggregatesCursor = {
  /** `createdAt` of the last item on the previous page. */
  value: string;
  /** Tie-breaker for items with identical `createdAt`. */
  id: string;
};

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

  const rubricTemplate = (instance.instanceData.rubricTemplate ??
    null) as RubricTemplateSchema | null;
  const scoredCriterionKeys = getScoredCriterionKeys(rubricTemplate);

  const phaseId = input.phaseId ?? instance.currentStateId ?? undefined;

  if ('proposalIds' in input) {
    return listProposalsFiltered({
      proposalIds: input.proposalIds,
      processInstanceId,
      phaseId,
      scoredCriterionKeys,
    });
  }

  return listProposalsPaginated({
    processInstanceId,
    phaseId,
    limit: input.limit,
    cursor: input.cursor,
    scoredCriterionKeys,
  });
}

// ── Filtered mode (caller-given proposalIds) ───────────────────────────

async function listProposalsFiltered({
  proposalIds,
  processInstanceId,
  phaseId,
  scoredCriterionKeys,
}: {
  proposalIds: string[];
  processInstanceId: string;
  phaseId: string | undefined;
  scoredCriterionKeys: string[];
}): Promise<ProposalsWithReviewAggregatesList> {
  const [proposalsFull, categoriesByProposalId] = await Promise.all([
    db.query.proposals.findMany({
      where: { id: { in: proposalIds } },
      with: proposalRelations({ processInstanceId, phaseId }),
    }),
    loadCategoriesByProposalIds(proposalIds),
  ]);

  const proposalsById = new Map(proposalsFull.map((p) => [p.id, p]));

  // Drop unmatched (cross-instance, deleted, etc). Preserve caller order.
  const items = proposalIds
    .map((id) => proposalsById.get(id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined)
    .filter((p) => p.processInstanceId === processInstanceId)
    .map((proposal) => ({
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
      aggregates: computeReviewAggregates(
        proposal.reviewAssignments,
        scoredCriterionKeys,
      ),
      categories: categoriesByProposalId.get(proposal.id) ?? [],
    }));

  return proposalsWithReviewAggregatesListSchema.parse({
    items,
    total: items.length,
    nextCursor: null,
  });
}

// ── Paginated mode (phase-scoped, cursor) ──────────────────────────────

async function listProposalsPaginated({
  processInstanceId,
  phaseId,
  limit,
  cursor,
  scoredCriterionKeys,
}: {
  processInstanceId: string;
  phaseId: string | undefined;
  limit: number;
  cursor: string | undefined;
  scoredCriterionKeys: string[];
}): Promise<ProposalsWithReviewAggregatesList> {
  const phaseProposalIds = await getProposalIdsForPhase({
    instanceId: processInstanceId,
    phaseId,
  });

  if (phaseProposalIds.length === 0) {
    return { items: [], total: 0, nextCursor: null };
  }

  const decodedCursor = cursor
    ? decodeCursor<AggregatesCursor>(cursor)
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
            })!,
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
    return { items: [], total, nextCursor: null };
  }

  const pageIds = pageRows.map((p) => p.id);
  const categoriesByProposalId = await loadCategoriesByProposalIds(pageIds);

  const items = pageRows.map((proposal) => ({
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
    aggregates: computeReviewAggregates(
      proposal.reviewAssignments,
      scoredCriterionKeys,
    ),
    categories: categoriesByProposalId.get(proposal.id) ?? [],
  }));

  let nextCursor: string | null = null;
  if (hasMore) {
    const lastRow = pageRows[pageRows.length - 1]!;
    nextCursor = encodeCursor<AggregatesCursor>({
      value: lastRow.createdAt ?? '',
      id: lastRow.id,
    });
  }

  return proposalsWithReviewAggregatesListSchema.parse({
    items,
    total,
    nextCursor,
  });
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * `with` block for the proposal relational query — shared by filtered and
 * paginated. The nested `where` on `reviewAssignments` is what scopes
 * assignments (and their reviews) to the right phase, so cross-phase
 * reviews don't leak into aggregates.
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

function getScoredCriterionKeys(
  rubricTemplate: RubricTemplateSchema | null,
): string[] {
  if (!rubricTemplate) {
    return [];
  }
  return getRubricScoringInfo(rubricTemplate)
    .criteria.filter((c) => c.scored)
    .map((c) => c.key);
}

async function loadCategoriesByProposalIds(
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
function computeReviewAggregates(
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

  let reviewsSubmitted = 0;
  let totalScore = 0;
  const overallRecommendationCount: Record<string, number> = {};

  for (const assignment of reviewAssignments) {
    const review = assignment.reviews[0];
    if (!review || review.state !== ProposalReviewState.SUBMITTED) {
      continue;
    }
    reviewsSubmitted += 1;

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

    const reco = answers[OVERALL_RECOMMENDATION_KEY];
    if (reco !== null && reco !== undefined) {
      const answerKey = String(reco);
      overallRecommendationCount[answerKey] =
        (overallRecommendationCount[answerKey] ?? 0) + 1;
    }
  }

  const averageScore =
    reviewsSubmitted === 0 ? 0 : totalScore / reviewsSubmitted;

  return {
    assignmentsTotal: reviewAssignments.length,
    reviewsSubmitted,
    averageScore,
    overallRecommendationCount,
    reviewers,
  };
}
