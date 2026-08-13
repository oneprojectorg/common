import { createClient } from '@op/api/serverClient';
import { CommonError } from '@op/common';
import { forbidden, notFound } from 'next/navigation';

import { ReviewLayout } from '@/components/decisions/Review/ReviewLayout';
import { ReviewSummaryLayout } from '@/components/decisions/ReviewSummary/ReviewSummaryLayout';

interface ProposalReviewsLayoutProps {
  decisionSlug: string;
  proposalProfileId: string;
}

/**
 * Resolves the proposal-keyed reviews URL per viewer:
 *   1. instance admin        → the "Review Progress" summary screen
 *   2. reviewer assigned in the current phase → their own review screen
 *   3. anyone else           → forbidden()
 *
 * Once the instance advances past the review phase, a reviewer's own review is
 * reachable through its `/reviews/[assignmentId]` link, and this URL belongs to
 * the admin summary (which walks back to the last review phase).
 */
export async function ProposalReviewsLayout({
  decisionSlug,
  proposalProfileId,
}: ProposalReviewsLayoutProps) {
  const client = await createClient();

  let decisionProfile;
  try {
    decisionProfile = await client.decision.getDecisionBySlug({
      slug: decisionSlug,
    });
  } catch (error) {
    interruptForCommonError(error);
    throw error;
  }

  if (!decisionProfile?.processInstance) {
    notFound();
  }

  if (decisionProfile.processInstance.access?.admin) {
    return (
      <ReviewSummaryLayout
        decisionSlug={decisionSlug}
        proposalProfileId={proposalProfileId}
      />
    );
  }

  // The reviewer branch means "review now", so it is scoped to the current
  // phase — a stateless instance has no phase to review in.
  const phaseId = decisionProfile.processInstance.currentStateId;
  if (!phaseId) {
    forbidden();
  }

  let assignmentId: string | undefined;
  try {
    // 'newest' orders by assignedAt (id tie-break) in SQL, so the first row is
    // the latest of this phase's assignments.
    const { assignments } = await client.decision.listReviewAssignments({
      processInstanceId: decisionProfile.processInstance.id,
      proposalProfileId,
      phaseId,
      sort: 'newest',
    });

    assignmentId = assignments[0]?.assignment.id;
  } catch (error) {
    interruptForCommonError(error);
    throw error;
  }

  // Neither admin nor a reviewer of this proposal.
  if (!assignmentId) {
    forbidden();
  }

  return (
    <ReviewLayout decisionSlug={decisionSlug} assignmentId={assignmentId} />
  );
}

/**
 * Maps a tRPC failure to the interrupt both review layouts use. 401 joins 403 so
 * an anonymous SSR pass renders the forbidden screen instead of a 500.
 */
function interruptForCommonError(error: unknown): void {
  const cause = error instanceof Error ? error.cause : null;
  if (!(cause instanceof CommonError)) {
    return;
  }
  if (cause.statusCode === 401 || cause.statusCode === 403) {
    forbidden();
  }
  if (cause.statusCode === 404 || cause.statusCode === 400) {
    notFound();
  }
}
