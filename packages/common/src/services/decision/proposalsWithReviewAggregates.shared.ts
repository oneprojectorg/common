import { db, eq, inArray } from '@op/db/client';
import {
  ProposalReviewState,
  proposalCategories,
  taxonomyTerms,
} from '@op/db/schema';

import {
  OVERALL_RECOMMENDATION_KEY,
  getRubricScoringInfo,
} from './getRubricScoringInfo';
import { parseProposalData } from './proposalDataSchema';
import type { ProposalCategoryItem } from './schemas/reviews';
import type { RubricTemplateSchema } from './types';

/**
 * Keys of integer-scored criteria from a rubric template — the ones that
 * contribute to `totalScore`. Returns `[]` for legacy/missing rubrics.
 */
export function getScoredCriterionKeys(
  rubricTemplate: RubricTemplateSchema | null,
): string[] {
  if (!rubricTemplate) {
    return [];
  }
  return getRubricScoringInfo(rubricTemplate)
    .criteria.filter((c) => c.scored)
    .map((c) => c.key);
}

/**
 * The `with` block shared by hydrate and list. Both routes load the same
 * relational tree (profile, submittedBy, reviewAssignments → reviewer +
 * reviews); only the proposal-level `where` / `orderBy` / `limit` differ.
 *
 * `phaseId` filters review assignments so cross-phase reviews don't leak
 * into the loaded tree.
 */
export function proposalsWithReviewsRelations({
  processInstanceId,
  phaseId,
}: {
  processInstanceId: string;
  phaseId?: string;
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

// Type-only probe: never called at runtime. Drizzle's relational return type
// depends on the `with` block shape, so we re-issue the same shape we use at
// runtime to derive the loaded row type.
async function _loadedProposalProbe() {
  return db.query.proposals.findMany({
    with: proposalsWithReviewsRelations({ processInstanceId: '' }),
  });
}

export type LoadedProposal = Awaited<
  ReturnType<typeof _loadedProposalProbe>
>[number];

type LoadedReviewAssignment = LoadedProposal['reviewAssignments'][number];

/**
 * Sidecar load of categories for a set of proposal IDs. Lives outside the
 * relational tree because proposals → proposalCategories → taxonomyTerms
 * isn't wired into the v2 relations yet. Returns an empty map for empty input
 * so callers can unconditionally Promise.all this.
 */
export async function loadCategoriesByProposalIds(
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
 * Compute per-proposal aggregates in JS from a loaded relational tree.
 *
 * Score handling: scored criterion answers stored as numbers are summed
 * directly; numeric strings are coerced. Anything else is ignored.
 */
export function computeAggregatesInJs(
  reviewAssignments: LoadedReviewAssignment[],
  scoredCriterionKeys: string[],
) {
  const reviewers = reviewAssignments.map((a) => ({
    profile: a.reviewer,
    status: a.status,
  }));

  const assignmentsTotal = reviewAssignments.length;
  let reviewsSubmitted = 0;
  let totalScore = 0;
  const overallRecommendationCount: Record<string, number> = {};

  for (const assignment of reviewAssignments) {
    for (const review of assignment.reviews) {
      if (review.state !== ProposalReviewState.SUBMITTED) {
        continue;
      }
      reviewsSubmitted += 1;

      const data = review.reviewData as {
        answers?: Record<string, unknown>;
      } | null;
      const answers = data?.answers ?? {};

      for (const key of scoredCriterionKeys) {
        const value = answers[key];
        if (typeof value === 'number') {
          totalScore += value;
        } else if (typeof value === 'string') {
          const n = Number(value);
          if (!Number.isNaN(n)) {
            totalScore += n;
          }
        }
      }

      const reco = answers[OVERALL_RECOMMENDATION_KEY];
      if (reco !== null && reco !== undefined) {
        const answerKey = String(reco);
        overallRecommendationCount[answerKey] =
          (overallRecommendationCount[answerKey] ?? 0) + 1;
      }
    }
  }

  const averageScore =
    reviewsSubmitted === 0 ? 0 : totalScore / reviewsSubmitted;

  return {
    assignmentsTotal,
    reviewsSubmitted,
    totalScore,
    averageScore,
    overallRecommendationCount,
    reviewers,
  };
}

interface AssembleInput {
  proposal: LoadedProposal;
  aggregates: ReturnType<typeof computeAggregatesInJs>;
  categories: ProposalCategoryItem[];
}

/**
 * Build the per-item shape returned by both hydrate and list endpoints.
 * Centralised so the two paths can't drift on the response shape.
 */
export function assembleProposalWithAggregates({
  proposal,
  aggregates,
  categories,
}: AssembleInput) {
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
    aggregates,
    categories,
  };
}
