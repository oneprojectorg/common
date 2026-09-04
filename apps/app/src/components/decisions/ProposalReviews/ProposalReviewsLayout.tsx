import { createClient } from '@op/api/serverClient';
import { CommonError } from '@op/common';
import { forbidden, notFound } from 'next/navigation';
import { Suspense } from 'react';

import { ReviewLayout } from '@/components/decisions/Review/ReviewLayout';
import { ReviewSkeleton } from '@/components/decisions/Review/ReviewSkeleton';
import { ReviewSummaryLayout } from '@/components/decisions/ReviewSummary/ReviewSummaryLayout';
import { ReviewSummarySkeleton } from '@/components/decisions/ReviewSummary/ReviewSummarySkeleton';

interface ProposalReviewsLayoutProps {
  decisionSlug: string;
  proposalProfileId: string;
}

interface ReviewerReviewProps {
  decisionSlug: string;
  processInstanceId: string;
  proposalProfileId: string;
  phaseId: string;
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
 *
 * Only the slug fetch that picks the branch is awaited here — the route's
 * neutral `loading.tsx` shell covers it. Each branch then streams behind the
 * skeleton of the screen it resolves to, so a viewer sees one skeleton shape,
 * not a route-shaped one replaced by a role-shaped one.
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
      <Suspense fallback={<ReviewSummarySkeleton />}>
        <ReviewSummaryLayout
          decisionSlug={decisionSlug}
          proposalProfileId={proposalProfileId}
        />
      </Suspense>
    );
  }

  // The reviewer branch means "review now", so it is scoped to the current
  // phase — a stateless instance has no phase to review in.
  const phaseId = decisionProfile.processInstance.currentStateId;
  if (!phaseId) {
    forbidden();
  }

  return (
    <Suspense fallback={<ReviewSkeleton />}>
      <ReviewerReview
        decisionSlug={decisionSlug}
        processInstanceId={decisionProfile.processInstance.id}
        proposalProfileId={proposalProfileId}
        phaseId={phaseId}
      />
    </Suspense>
  );
}

/**
 * Resolves the viewer's assignment for this proposal in `phaseId` and hands it
 * to the review screen. Suspended by the caller so the wait runs behind the
 * review screen's own skeleton.
 */
async function ReviewerReview({
  decisionSlug,
  processInstanceId,
  proposalProfileId,
  phaseId,
}: ReviewerReviewProps) {
  const client = await createClient();

  let assignmentId: string | undefined;
  try {
    // 'newest' orders by assignedAt (id tie-break) in SQL, so the first row is
    // the latest of this phase's assignments.
    const { assignments } = await client.decision.listReviewAssignments({
      processInstanceId,
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
