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
import { getCurrentProposalHistoryIds } from './proposal/history';
import { isReviewOutOfDate } from './review/staleness';
import { assertCanReadPhaseReviews } from './reviewHelpers';
import { instanceOptionalPhaseRefSchema } from './schemas/instance';
import {
  type ProposalWithSubmittedReviews,
  proposalWithSubmittedReviewsSchema,
} from './schemas/reviews';
import { getPhaseRubricTemplate } from './utils/phaseTemplates';

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
 * derived values (reviews[], aggregates) are per-source-phase. Omitted
 * defaults to the instance's current phase — admin-only; reviewers must
 * always name a phase.
 */
export async function getProposalWithReviewAggregates(
  input: GetProposalWithReviewAggregatesInput & { user: User },
): Promise<ProposalWithSubmittedReviews> {
  const { user, processInstanceId, proposalId } = input;

  const instance = await getInstance({ instanceId: processInstanceId, user });

  // Effective phase: explicit `phaseId`, else the instance's current phase —
  // mirrors `listProposalsWithReviewAggregates`, so there is no cross-phase
  // blended mode.
  const phaseId = input.phaseId ?? instance.currentStateId ?? undefined;

  // Resolved by the effective phase so each phase's reviews are scored (and
  // rendered by clients) against that phase's rubric.
  const rubricTemplate = getPhaseRubricTemplate(instance.instanceData, phaseId);
  const scoredCriterionKeys = rubricTemplate
    ? getRubricScoringInfo(rubricTemplate)
        .criteria.filter((c) => c.scored)
        .map((c) => c.key)
    : [];

  // Read gate — see `canReadPhaseReviews`. On the caller's raw phaseId, so a
  // reviewer must name one; the reads only return once it passes.
  const [proposal, categoriesByProposalId, currentHistoryIdByProposal] =
    await Promise.all([
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
      getCurrentProposalHistoryIds({ proposalIds: [proposalId] }),
      assertCanReadPhaseReviews({ instance, phaseId: input.phaseId, user }),
    ]);

  if (!proposal || proposal.processInstanceId !== processInstanceId) {
    throw new NotFoundError('Proposal', proposalId);
  }

  // One batched lookup for the whole read; the staleness rule is a pure
  // comparison against it, so nothing fans out per review row.
  const currentProposalHistoryId = currentHistoryIdByProposal.get(proposal.id);

  const aggregates = getComputedReviewAggregates({
    reviewAssignments: proposal.reviewAssignments,
    scoredCriterionKeys,
    currentProposalHistoryId,
  });

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
        isReviewOutOfDate: isReviewOutOfDate({
          assignment,
          review: reviewRow,
          currentProposalHistoryId,
        }),
      },
    ];
  });

  return proposalWithSubmittedReviewsSchema.parse({
    proposal,
    aggregates,
    categories: categoriesByProposalId.get(proposal.id) ?? [],
    reviews,
    rubricTemplate,
  });
}
