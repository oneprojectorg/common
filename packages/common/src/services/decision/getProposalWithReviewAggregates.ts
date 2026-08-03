import { and, db, eq, isNull } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { z } from 'zod';

import { NotFoundError } from '../../utils';
import { getInstance } from './getInstance';
import { getRubricScoringInfo } from './getRubricScoringInfo';
import {
  getCategoriesByProposalIds,
  getComputedReviewAggregates,
  getSubmittedReviewScore,
  proposalRelations,
} from './listProposalsWithReviewAggregates';
import { assertCanReadPhaseReviews } from './reviewHelpers';
import { instanceOptionalPhaseRefSchema } from './schemas/instance';
import {
  type ProposalWithSubmittedReviews,
  proposalWithSubmittedReviewsSchema,
} from './schemas/reviews';

export const getProposalWithReviewAggregatesInputSchema =
  instanceOptionalPhaseRefSchema.extend({
    proposalId: z.uuid(),
  });

export type GetProposalWithReviewAggregatesInput = z.infer<
  typeof getProposalWithReviewAggregatesInputSchema
>;

/**
 * Submitted-only by design: drafts and unstarted assignments contribute to
 * `aggregates.assignmentsCount` but are not surfaced in `reviews[]`.
 *
 * `phaseId` scopes the review set to assignments pinned to that phase, so all
 * derived values (reviews[], aggregates) are per-source-phase. Omitted means
 * all phases — admin-only; reviewers must always name a phase.
 */
export async function getProposalWithReviewAggregates(
  input: GetProposalWithReviewAggregatesInput & { user: User },
): Promise<ProposalWithSubmittedReviews> {
  const { user, processInstanceId, proposalId, phaseId } = input;

  const instance = await getInstance({ instanceId: processInstanceId, user });

  // Read gate: admin, or the process-wide reviewer grant on an open phase at
  // or before the current one — see `canReadPhaseReviews` for the semantics.
  assertCanReadPhaseReviews(instance, phaseId);

  const rubricTemplate = instance.instanceData.rubricTemplate;
  const scoredCriterionKeys = rubricTemplate
    ? getRubricScoringInfo(rubricTemplate)
        .criteria.filter((c) => c.scored)
        .map((c) => c.key)
    : [];

  const [proposal, categoriesByProposalId] = await Promise.all([
    db.query.proposals.findFirst({
      // Moderation-detached (CSAM) proposals are treated as not-found even
      // for admins — same 404 the endpoint returns for a plain missing row.
      where: {
        RAW: (table) =>
          and(eq(table.id, proposalId), isNull(table.moderationDetachedAt))!,
      },
      with: proposalRelations({ processInstanceId, phaseId }),
    }),
    getCategoriesByProposalIds([proposalId]),
  ]);

  if (!proposal || proposal.processInstanceId !== processInstanceId) {
    throw new NotFoundError('Proposal', proposalId);
  }

  const aggregates = getComputedReviewAggregates(
    proposal.reviewAssignments,
    scoredCriterionKeys,
  );

  const reviews = proposal.reviewAssignments.flatMap((assignment) => {
    const reviewRow = assignment.reviews[0];
    const scored = getSubmittedReviewScore(reviewRow, scoredCriterionKeys);
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
