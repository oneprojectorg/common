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

interface LoadProposalDataInput {
  proposalIds: string[];
  processInstanceId: string;
  /** When set, review assignments (and their reviews) are filtered to this phase. */
  phaseId?: string;
}

/**
 * Load the relational tree + categories for a set of proposal IDs. Two
 * parallel queries: the v2 relational query for everything that's wired up
 * (profile, submittedBy, reviewAssignments → reviewer + reviews), and a
 * sidecar join for categories (proposals → proposalCategories → taxonomyTerms
 * isn't in the relational graph yet).
 */
export async function loadProposalDataForAggregation({
  proposalIds,
  processInstanceId,
  phaseId,
}: LoadProposalDataInput) {
  const assignmentWhere: Record<string, string> = { processInstanceId };
  if (phaseId) {
    assignmentWhere.phaseId = phaseId;
  }

  const [proposalsFull, categoryRows] = await Promise.all([
    db.query.proposals.findMany({
      where: { id: { in: proposalIds } },
      with: {
        profile: { with: { avatarImage: true } },
        submittedBy: { with: { avatarImage: true } },
        reviewAssignments: {
          where: assignmentWhere,
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
      .where(inArray(proposalCategories.proposalId, proposalIds)),
  ]);

  const proposalsById = new Map(proposalsFull.map((p) => [p.id, p]));

  const categoriesByProposalId = new Map<string, ProposalCategoryItem[]>();
  for (const row of categoryRows) {
    const list = categoriesByProposalId.get(row.proposalId) ?? [];
    list.push({ id: row.id, label: row.label, termUri: row.termUri });
    categoriesByProposalId.set(row.proposalId, list);
  }

  return { proposalsById, categoriesByProposalId };
}

export type LoadedProposal = NonNullable<
  Awaited<
    ReturnType<typeof loadProposalDataForAggregation>
  >['proposalsById'] extends Map<string, infer V>
    ? V
    : never
>;

type LoadedReviewAssignment = LoadedProposal['reviewAssignments'][number];

/**
 * Compute per-proposal aggregates in JS from a loaded relational tree.
 *
 * Used by hydration mode and as the response source-of-truth for list
 * mode — the SQL agg subquery, when present, exists only to drive sort
 * and cursor pagination, not to populate the response.
 *
 * Score handling: scored criterion answers stored as numbers are summed
 * directly; numeric strings are coerced. Anything else is ignored, matching
 * the SQL `COALESCE(...->>key)::numeric` behavior.
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
