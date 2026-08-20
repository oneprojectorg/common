import { trackReviewUpdated } from '@op/analytics';
import { and, db, eq } from '@op/db/client';
import {
  type ProposalReview,
  ProposalReviewState,
  proposalReviewAssignments,
  proposalReviews,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { waitUntil } from '@vercel/functions';

import { ValidationError } from '../../utils';
import { getRubricScoringInfo } from './getRubricScoringInfo';
import { getSubmittedReviewScore } from './listProposalsWithReviewAggregates';
import { assertReviewAssignmentContext } from './reviewHelpers';
import {
  getCurrentProposalHistoryId,
  isReviewOutOfDate,
} from './reviewStaleness';
import { schemaValidator } from './schemaValidator';
import type { RubricReviewData } from './schemas/reviews';
import { isInstanceCurrentPhase } from './utils/instance';

/**
 * Edits an already-submitted review in place — no version history — leaving
 * `state` and the assignment status untouched (`updatedAt` advances, so an edit
 * stays derivable). Only while the assignment's phase is still the instance's
 * current phase; frozen once the process advances past it.
 *
 * This is also the re-affirm path. The assignment's version pin is re-stamped
 * to the proposal's current history row on every edit, so an out-of-date review
 * (pin behind the proposal) becomes current again. When the review *was* out of
 * date, `submittedAt` advances too: the reviewer has now judged this version.
 * An edit of an already-current review leaves `submittedAt` alone.
 */
export async function updateReview({
  assignmentId,
  reviewData,
  overallComment,
  user,
}: {
  assignmentId: string;
  reviewData: RubricReviewData;
  overallComment?: string | null;
  user: User;
}): Promise<{ review: ProposalReview; processInstanceId: string }> {
  const context = await assertReviewAssignmentContext({
    assignmentId,
    user,
  });

  if (context.review?.state !== ProposalReviewState.SUBMITTED) {
    throw new ValidationError('Review has not been submitted yet');
  }

  // getInstance's currentStateId is cached and can lag a phase advance, so
  // re-read the live phase directly rather than trust context.instance.
  const liveInstance = await db.query.processInstances.findFirst({
    where: { id: context.assignment.processInstanceId },
    columns: { currentStateId: true },
  });

  if (
    !isInstanceCurrentPhase(
      { currentStateId: liveInstance?.currentStateId ?? null },
      context.assignment.phaseId,
    )
  ) {
    throw new ValidationError(
      'This review can no longer be edited because the review phase has ended',
    );
  }

  if (!context.rubricTemplate) {
    throw new ValidationError('Rubric template not found for this assignment');
  }

  schemaValidator.assertRubricData(context.rubricTemplate, reviewData.answers);

  const { review: updatedReview, wasStale } = await db.transaction(
    async (tx) => {
      const currentProposalHistoryId = await getCurrentProposalHistoryId(
        context.assignment.proposalId,
        tx,
      );

      // Read the staleness *before* the pin moves — the edit is a re-affirm
      // only if the review was behind the proposal when it started.
      const stale = isReviewOutOfDate({
        assignment: context.assignment,
        review: context.review,
        currentProposalHistoryId,
      });

      const [row] = await tx
        .update(proposalReviews)
        .set({
          reviewData,
          overallComment: overallComment ?? null,
          // A re-affirm is a fresh judgement of the current version.
          ...(stale && { submittedAt: new Date().toISOString() }),
        })
        // Defensive: the row must still be SUBMITTED (nothing un-submits today).
        .where(
          and(
            eq(proposalReviews.assignmentId, assignmentId),
            eq(proposalReviews.state, ProposalReviewState.SUBMITTED),
          ),
        )
        .returning();

      if (!row) {
        throw new ValidationError(
          'This review can no longer be edited; please refresh and try again',
        );
      }

      // Re-stamp the pin: this edit reviewed the proposal as it stands now.
      if (
        currentProposalHistoryId &&
        currentProposalHistoryId !==
          context.assignment.assignedProposalHistoryId
      ) {
        await tx
          .update(proposalReviewAssignments)
          .set({ assignedProposalHistoryId: currentProposalHistoryId })
          .where(eq(proposalReviewAssignments.id, assignmentId));
      }

      return { review: row, wasStale: stale };
    },
  );

  const scoredCriterionKeys = getRubricScoringInfo(context.rubricTemplate)
    .criteria.filter((criterion) => criterion.scored)
    .map((criterion) => criterion.key);
  const scored = getSubmittedReviewScore(updatedReview, scoredCriterionKeys);

  waitUntil(
    trackReviewUpdated(
      user.id,
      context.assignment.processInstanceId,
      context.assignment.proposalId,
      {
        assignment_id: assignmentId,
        phase_id: context.assignment.phaseId,
        recommendation: scored?.overallRecommendation ?? null,
        score: scored?.score ?? null,
        was_stale: wasStale,
      },
    ),
  );

  return {
    review: updatedReview,
    processInstanceId: context.assignment.processInstanceId,
  };
}
