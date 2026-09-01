import { and, db, eq, inArray, isNull } from '@op/db/client';
import {
  ProposalReviewState,
  proposalCategories,
  taxonomyTerms,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { z } from 'zod';

import { UnauthorizedError } from '../../utils';
import { getInstance } from './getInstance';
import { getProposalIdsForPhase } from './getProposalsForPhase';
import {
  OVERALL_RECOMMENDATION_KEY,
  getRubricScoringInfo,
} from './getRubricScoringInfo';
import { assertCanReadPhaseReviews } from './reviewHelpers';
import { instanceOptionalPhaseRefSchema } from './schemas/instance';
import {
  type ProposalCategoryItem,
  type ProposalsWithReviewAggregatesList,
  proposalsWithReviewAggregatesListSchema,
} from './schemas/reviews';
import type { RubricTemplateSchema } from './types';
import { getPhaseRubricTemplate } from './utils/phaseTemplates';

// ── Input schema ───────────────────────────────────────────────────────

/**
 * Single union schema for both dispatch modes:
 *   - filtered: caller passes `proposalIds`.
 *   - phase-scoped: no `proposalIds`, returns the whole phase.
 *
 * The two branches stay separate because they authorize differently; see the
 * dispatch note on `listProposalsWithReviewAggregates`.
 *
 * The phase-scoped branch is strict so a filtered read that fails validation
 * (empty `proposalIds`, a malformed uuid) is rejected instead of falling
 * through to it with the key stripped — that fallthrough would hand a caller
 * who asked for a few proposals the entire phase.
 */
export const listProposalsWithReviewAggregatesInputSchema = z.union([
  instanceOptionalPhaseRefSchema.extend({
    proposalIds: z.array(z.uuid()).min(1),
  }),
  z.strictObject(instanceOptionalPhaseRefSchema.shape),
]);

export type ListProposalsWithReviewAggregatesInput = z.infer<
  typeof listProposalsWithReviewAggregatesInputSchema
>;

// ── Public entry ───────────────────────────────────────────────────────

/**
 * Proposal list with per-proposal review aggregates. Two dispatch modes
 * determined by input shape:
 *
 *   - filtered (`proposalIds` present): caller-owned ID list.
 *     Gated by `canReadPhaseReviews` — admins always, reviewers on a named
 *     `openReviews` phase (the same gate as the per-proposal review set).
 *   - phase-scoped: every proposal in the phase, `createdAt DESC`. Admin-only.
 */
export async function listProposalsWithReviewAggregates(
  input: ListProposalsWithReviewAggregatesInput & { user: User },
): Promise<ProposalsWithReviewAggregatesList> {
  const { user, processInstanceId } = input;

  const instance = await getInstance({ instanceId: processInstanceId, user });

  if ('proposalIds' in input) {
    // Raw `phaseId`, not the effective one: a reviewer must name the phase.
    assertCanReadPhaseReviews(instance, input.phaseId);
  } else if (!instance.access.admin) {
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

  return listPhaseProposalsWithAggregates({
    processInstanceId,
    phaseId,
    phaseProposalIds,
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
    return { items: [], rubricTemplate };
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
    rubricTemplate,
  });
}

// ── Phase-scoped mode (whole phase) ───────────────────────────────────

/**
 * Unbounded by construction, like `listSelectionCandidates`: a phase is a
 * bounded set that an admin has to see whole to act on it. A page limit here
 * silently hid every proposal past the first 50 from the advance screen.
 */
async function listPhaseProposalsWithAggregates({
  processInstanceId,
  phaseId,
  phaseProposalIds,
  scoredCriterionKeys,
  rubricTemplate,
}: {
  processInstanceId: string;
  phaseId: string | undefined;
  phaseProposalIds: string[];
  scoredCriterionKeys: string[];
  rubricTemplate: RubricTemplateSchema | null;
}): Promise<ProposalsWithReviewAggregatesList> {
  if (phaseProposalIds.length === 0) {
    return { items: [], rubricTemplate };
  }

  const rows = await db.query.proposals.findMany({
    // Defense-in-depth: `phaseProposalIds` is already detach-filtered by
    // getProposalsForPhase, but the extra `moderationDetachedAt IS NULL`
    // guards against a future caller / bug slipping a detached ID in.
    where: {
      RAW: (table) =>
        and(
          inArray(table.id, phaseProposalIds),
          isNull(table.moderationDetachedAt),
        )!,
    },
    with: proposalRelations({ processInstanceId, phaseId }),
    orderBy: { createdAt: 'desc', id: 'desc' },
  });

  if (rows.length === 0) {
    return { items: [], rubricTemplate };
  }

  const categoriesByProposalId = await getCategoriesByProposalIds(
    rows.map((p) => p.id),
  );

  const items = rows.map((proposal) => ({
    proposal,
    aggregates: getComputedReviewAggregates(
      proposal.reviewAssignments,
      scoredCriterionKeys,
    ),
    categories: categoriesByProposalId.get(proposal.id) ?? [],
  }));

  return proposalsWithReviewAggregatesListSchema.parse({
    items,
    rubricTemplate,
  });
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * `with` block for the proposal relational query — shared by filtered and
 * phase-scoped.
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
