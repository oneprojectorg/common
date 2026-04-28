import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { z } from 'zod';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { getInstance } from './getInstance';
import { getRubricScoringInfo } from './getRubricScoringInfo';
import {
  computeReviewAggregates,
  loadCategoriesByProposalIds,
  proposalRelations,
  scoreSubmittedReview,
} from './listProposalsWithReviewAggregates';
import {
  type ProposalWithSubmittedReviews,
  proposalWithSubmittedReviewsSchema,
} from './schemas/reviews';
import type { RubricTemplateSchema } from './types';

// ── Input schema ───────────────────────────────────────────────────────

export const getProposalWithReviewAggregatesInputSchema = z.object({
  processInstanceId: z.uuid(),
  proposalId: z.uuid(),
  phaseId: z.string().optional(),
});

export type GetProposalWithReviewAggregatesInput = z.infer<
  typeof getProposalWithReviewAggregatesInputSchema
>;

// ── Public entry ───────────────────────────────────────────────────────

/**
 * Admin-only single-proposal view with both the aggregate strip used by the
 * Review Summary panel and the per-reviewer submitted-review payload used by
 * the reviewer drill-down.
 *
 * Submitted-only by design: drafts and unstarted assignments contribute to
 * `aggregates.assignmentsTotal` (so "5 of 8 submitted" still renders) but
 * are not surfaced in `reviews[]`.
 */
export async function getProposalWithReviewAggregates(
  input: GetProposalWithReviewAggregatesInput & { user: User },
): Promise<ProposalWithSubmittedReviews> {
  const { user, processInstanceId, proposalId } = input;

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

  const phaseId = input.phaseId ?? instance.currentStateId ?? undefined;

  const [proposal, categoriesByProposalId] = await Promise.all([
    db.query.proposals.findFirst({
      where: { id: proposalId },
      with: proposalRelations({ processInstanceId, phaseId }),
    }),
    loadCategoriesByProposalIds([proposalId]),
  ]);

  if (!proposal || proposal.processInstanceId !== processInstanceId) {
    throw new NotFoundError('Proposal not found');
  }

  const aggregates = computeReviewAggregates(
    proposal.reviewAssignments,
    scoredCriterionKeys,
  );

  const reviews = proposal.reviewAssignments.flatMap((assignment) => {
    const reviewRow = assignment.reviews[0];
    const scored = scoreSubmittedReview(reviewRow, scoredCriterionKeys);
    if (!scored || !reviewRow) {
      return [];
    }
    return [
      {
        review: reviewRow,
        reviewer: assignment.reviewer,
        assignmentStatus: assignment.status,
        score: scored.score,
        overallRecommendation: scored.overallRecommendation,
      },
    ];
  });

  return proposalWithSubmittedReviewsSchema.parse({
    proposal,
    aggregates,
    categories: categoriesByProposalId.get(proposal.id) ?? [],
    reviews,
  });
}
