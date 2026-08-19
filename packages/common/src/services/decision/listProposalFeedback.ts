import { and, db, eq, isNull } from '@op/db/client';
import { ProposalReviewState } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { assertUserByAuthId } from '../assert';
import { getInstance } from './getInstance';
import { assertProposalReviewArtifactAccess } from './reviewHelpers';
import { hasPhaseEnded } from './utils/phaseOrder';

/**
 * `with` config for the author-feedback read: the proposal's review
 * assignments and, under each, its submitted reviews. Deliberately not derived
 * from `proposalWithRevisionRequestsConfig` — that config joins the author
 * profile, avatar and instance profile for the revision-request card, none of
 * which this endpoint returns. Here `reviewerProfileId` is never selected:
 * anonymity is structural, not a runtime setting.
 */
const proposalWithSubmittedFeedbackConfig = {
  reviewAssignments: {
    columns: { id: true as const, phaseId: true as const },
    with: {
      reviews: {
        where: { state: ProposalReviewState.SUBMITTED },
        columns: {
          id: true as const,
          overallComment: true as const,
          submittedAt: true as const,
        },
        orderBy: {
          submittedAt: 'desc' as const,
        },
      },
    },
  },
} as const;

/**
 * Proposal-scoped: the anonymized notes reviewers left for the author
 * (`proposalReviews.overallComment`) on a single proposal. Visible to the
 * proposal author, decision admins, and any user with the REVIEW capability
 * on the instance.
 *
 * One contract for every caller: a note is released only once the review
 * phase that produced it has ended. While the phase is current, reviewers can
 * still edit a submitted review (`canEditSubmittedReview`), so the note is not
 * final. Admins who need live data use `getProposalWithReviewAggregates`.
 */
export async function listProposalFeedback({
  proposalId,
  user,
}: {
  proposalId: string;
  user: User;
}) {
  // The proposal read doesn't depend on the caller's profile — resolve both at
  // once, as `assertReviewAssignmentContext` does.
  const [proposal, commonUser] = await Promise.all([
    db.query.proposals.findFirst({
      // Detached (CSAM) proposals return 404 — authors and reviewers alike
      // should not see reviewer feedback on a taken-down row.
      where: {
        RAW: (table) =>
          and(eq(table.id, proposalId), isNull(table.moderationDetachedAt))!,
      },
      with: proposalWithSubmittedFeedbackConfig,
    }),
    assertUserByAuthId(user.id),
  ]);

  if (!commonUser.profileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  if (!proposal) {
    throw new NotFoundError('Proposal', proposalId);
  }

  const instance = await getInstance({
    instanceId: proposal.processInstanceId,
    user,
  });

  await assertProposalReviewArtifactAccess({
    artifact: 'reviewer feedback',
    instance,
    profileId: commonUser.profileId,
    proposal,
    user,
  });

  const items = proposal.reviewAssignments
    .filter((assignment) =>
      hasPhaseEnded(
        instance.instanceData,
        assignment.phaseId,
        instance.currentStateId,
      ),
    )
    .flatMap((assignment) =>
      assignment.reviews
        .filter((review) => (review.overallComment ?? '').trim().length > 0)
        .map((review) => ({
          id: review.id,
          comment: (review.overallComment ?? '').trim(),
          phaseId: assignment.phaseId,
          submittedAt: review.submittedAt,
        })),
    )
    // Newest first across assignments. The nested `orderBy` only orders within
    // one assignment, and this list is fully in-memory and never paginated.
    .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));

  return {
    items,
    processInstanceId: proposal.processInstanceId,
  };
}
