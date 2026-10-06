import { serializeDehydratedState } from '@op/api/dehydratedState';
import { createServerUtils, dehydrate } from '@op/api/server';
import { createClient } from '@op/api/serverClient';
import { CommonError } from '@op/common';
import {
  assertInstancePhase,
  getPhaseReviewSettings,
  getPreviousPhases,
  isReviewPhase,
  resolveReviewSettings,
  type ReviewSettings,
} from '@op/common/client';
import '@tanstack/react-start/server-only';
import { forbidden, notFound } from '@/lib/navigation';

import type { PreviousReviewPhase } from '@/components/decisions/Review/ReviewTabs';

/** What the reviewer's split-pane review screen renders from. */
export async function loadReviewLayout({
  decisionSlug,
  assignmentId,
}: {
  decisionSlug: string;
  assignmentId: string;
}) {
  const [client, { utils, queryClient }] = await Promise.all([
    createClient(),
    createServerUtils(),
  ]);

  let reviewSettings: ReviewSettings;
  let previousReviewPhases: PreviousReviewPhase[];
  let reviewedProposal: { name: string | null } | null;
  let decisionName: string | null;
  try {
    const [decisionProfile, reviewAssignment] = await Promise.all([
      client.decision.getDecisionBySlug({ slug: decisionSlug }),
      utils.decision.getReviewAssignment.fetch({ assignmentId }),
    ]);

    const instanceData = decisionProfile.processInstance.instanceData;
    const assignmentPhaseId = reviewAssignment.assignment.phaseId;

    // Throws NotFoundError when the assignment's phase is no longer in the
    // instance's phase list (stale assignment) — mapped to notFound() below.
    reviewSettings = getPhaseReviewSettings(instanceData, assignmentPhaseId);

    // Earlier review phases whose `openReviews` keeps their reviews readable
    // from this screen. Strictly before the assignment's phase in the
    // instance's phase ordering, so the phase this screen reviews in never
    // doubles up with its own "Other reviews" tab.
    previousReviewPhases = getPreviousPhases(instanceData, assignmentPhaseId)
      .filter((phase) => {
        const settings = getPhaseReviewSettings(instanceData, phase.phaseId);
        return settings.submit && settings.openReviews;
      })
      .map((phase) => ({
        id: phase.phaseId,
        name: phase.name ?? phase.phaseId,
      }));

    const proposal = reviewAssignment.assignment.proposal;
    reviewedProposal = proposal
      ? { name: proposal.profile?.name ?? null }
      : null;
    decisionName = decisionProfile.name ?? null;
  } catch (error) {
    // tRPC errors carry the CommonError in `cause`; local throws are the error itself.
    const cause =
      error instanceof CommonError
        ? error
        : error instanceof Error
          ? error.cause
          : null;
    if (
      cause instanceof CommonError &&
      (cause.statusCode === 401 || cause.statusCode === 403)
    ) {
      forbidden();
    }
    if (cause instanceof CommonError && cause.statusCode === 404) {
      notFound();
    }
    throw error;
  }

  return {
    decisionSlug,
    assignmentId,
    reviewSettings,
    previousReviewPhases,
    dehydratedState: serializeDehydratedState(dehydrate(queryClient)),
    reviewedProposal,
    decisionName,
  };
}

/** What the admin "Review Progress" summary renders from. */
export async function loadReviewSummary({
  decisionSlug,
  proposalProfileId,
}: {
  decisionSlug: string;
  proposalProfileId: string;
}) {
  const client = await createClient();

  let decisionProfile;
  try {
    decisionProfile = await client.decision.getDecisionBySlug({
      slug: decisionSlug,
    });
  } catch (error) {
    const cause = error instanceof Error ? error.cause : null;
    if (cause instanceof CommonError && cause.statusCode === 403) {
      forbidden();
    }
    if (cause instanceof CommonError && cause.statusCode === 404) {
      notFound();
    }
    throw error;
  }

  if (!decisionProfile?.processInstance) {
    notFound();
  }

  if (!decisionProfile.processInstance.access?.admin) {
    forbidden();
  }

  const instanceId = decisionProfile.processInstance.id;

  const { utils, queryClient } = await createServerUtils();

  const [proposal, instance] = await Promise.all([
    (async () => {
      try {
        return await utils.decision.getProposal.fetch({
          profileId: proposalProfileId,
        });
      } catch (error) {
        const cause = error instanceof Error ? error.cause : null;
        // A missing proposal (404) or a malformed proposal id (400) is an
        // unresolvable path → 404; a genuine access denial → 403.
        if (
          cause instanceof CommonError &&
          (cause.statusCode === 404 || cause.statusCode === 400)
        ) {
          notFound();
        }
        if (cause instanceof CommonError && cause.statusCode === 403) {
          forbidden();
        }
        throw error;
      }
    })(),
    utils.decision.getInstance.fetch({ instanceId }),
  ]);

  if (proposal.processInstanceId !== instanceId) {
    notFound();
  }

  const proposalId = proposal.id;
  // Every read below is phase-scoped; no phase means no review to summarize.
  const phaseId = resolveReviewPhaseId(instance);
  if (!phaseId) {
    notFound();
  }

  // Keyed to the resolved review phase, like the aggregates below.
  const reviewSettings = resolveReviewSettings(
    instance.instanceData ?? {},
    phaseId,
  );

  // isReviewPhase guards the resolver's fallback, which returns the current
  // phase when the instance has no review phase at all.
  const isPhaseInProgress =
    phaseId === instance.currentStateId &&
    isReviewPhase(assertInstancePhase({ instance, phaseId }));

  await Promise.all([
    utils.decision.getProposalWithReviewAggregates.prefetch({
      processInstanceId: instanceId,
      proposalId,
      phaseId,
    }),
    // Same key as the query in ReviewSummaryView, `sort` included, or the
    // client refetches on mount.
    utils.decision.listReviewAssignments.prefetch({
      processInstanceId: instanceId,
      proposalProfileId,
      phaseId,
      sort: 'newest',
    }),
    // The left pane's author-notes card reads this unconditionally.
    utils.decision.listProposalRevisionNotes.prefetch({ proposalId }),
  ]);

  return {
    decisionSlug,
    instanceId,
    proposalId,
    proposalProfileId,
    phaseId,
    isPhaseInProgress,
    reviewSettings,
    dehydratedState: serializeDehydratedState(dehydrate(queryClient)),
  };
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
export async function loadProposalReviews({
  decisionSlug,
  proposalProfileId,
}: {
  decisionSlug: string;
  proposalProfileId: string;
}) {
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

  const decisionName = decisionProfile.name ?? null;

  if (decisionProfile.processInstance.access?.admin) {
    return {
      kind: 'summary' as const,
      decisionName,
      summary: await loadReviewSummary({ decisionSlug, proposalProfileId }),
    };
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
    const { items: assignments } = await client.decision.listReviewAssignments({
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

  return {
    kind: 'review' as const,
    decisionName,
    review: await loadReviewLayout({ decisionSlug, assignmentId }),
  };
}

// Walk back from the current phase to find the most recent review phase —
// after a review phase ends, currentStateId no longer points at it but the
// review assignments are still pinned to the original review phase id.
function resolveReviewPhaseId(instance: {
  currentStateId: string | null;
  instanceData?: {
    phases?: Array<{
      phaseId: string;
      rules?: { proposals?: { review?: boolean } };
    }>;
  } | null;
}): string | undefined {
  const phases = instance.instanceData?.phases ?? [];
  const currentIdx = phases.findIndex(
    (p) => p.phaseId === instance.currentStateId,
  );
  const startIdx = currentIdx === -1 ? phases.length - 1 : currentIdx;
  for (let i = startIdx; i >= 0; i--) {
    const phase = phases[i];
    if (phase && isReviewPhase(phase)) {
      return phase.phaseId;
    }
  }
  return instance.currentStateId ?? undefined;
}

/**
 * Maps a tRPC failure to the interrupt both review screens use. 401 joins 403
 * so an anonymous SSR pass renders the forbidden screen instead of a 500.
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
