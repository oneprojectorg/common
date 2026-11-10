'use client';

import type { RouterOutput } from '@op/api';
import { trpc } from '@op/api/client';
import { isLastPhase, isReviewPhase, isVotingPhase } from '@op/common/client';
import { notFound } from 'next/navigation';
import { useCallback } from 'react';

import { ProposalSheet } from './ProposalSheet/ProposalSheet';
import { ProposalSheetProvider } from './ProposalSheet/ProposalSheetProvider';
import { ReviewProgressProposalSheet } from './ProposalSheet/ReviewProgressProposalSheet';
import { FinalPhaseManualSelectionPage } from './pages/FinalPhaseManualSelectionPage';
import { ResultsPage } from './pages/ResultsPage';
import { ReviewPage } from './pages/ReviewPage';
import { ReviewSelectionPage } from './pages/ReviewSelectionPage';
import { StandardDecisionPage } from './pages/StandardDecisionPage';
import { VotingPage } from './pages/VotingPage';
import { useReviewTab } from './pages/useReviewTab';
import { proposalReviewsHref } from './proposalHrefs';

// Sticky filter-bar pin offset (px) for the decision-view layout — the clearance
// below the scroll container's top for the floating Overview/Current toggle that
// overhangs the header bottom on mobile. The bar pins just under the toggle;
// content above the bar (the phase header) scrolls up behind the toggle.
// The legacy /profile route has no toggle and falls back to the bar's 0 default.
const DECISION_VIEW_PIN_OFFSET = 56;

function DecisionStateRouterLegacy({
  instanceId,
  slug,
}: {
  instanceId: string;
  slug: string;
}) {
  // Legacy instances are always in results phase
  return <ResultsPage instanceId={instanceId} profileSlug={slug} useLegacy />;
}

type Instance = RouterOutput['decision']['getInstance'];

function DecisionStateRouterNew({
  instanceId,
  slug,
  decisionSlug,
}: {
  instanceId: string;
  slug: string;
  decisionSlug?: string;
}) {
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });
  const currentPhase = instance.instanceData?.phases?.find(
    (phase) => phase.phaseId === instance.currentStateId,
  );
  const isAdmin = Boolean(instance.access?.admin);
  const { showsAllProposals } = useReviewTab({
    isAdmin,
    canReview: Boolean(instance.access?.review),
  });

  // The one place that picks the sheet, so a tab change swaps it in the same
  // render instead of waiting on the departing tab panel to unmount.
  const reviewSheetPhaseId =
    instance.selectionsAreConfirmed &&
    currentPhase &&
    isReviewPhase(currentPhase) &&
    isAdmin &&
    showsAllProposals
      ? currentPhase.phaseId
      : null;

  const reviewsHref = useCallback(
    (profileId: string) =>
      proposalReviewsHref({ decisionSlug, slug, instanceId, profileId }),
    [decisionSlug, slug, instanceId],
  );

  return (
    <ProposalSheetProvider
      slug={slug}
      instanceId={instanceId}
      decisionSlug={decisionSlug}
      expandHref={reviewSheetPhaseId ? reviewsHref : undefined}
    >
      <DecisionPage
        instance={instance}
        slug={slug}
        decisionSlug={decisionSlug}
      />
      {reviewSheetPhaseId ? (
        <ReviewProgressProposalSheet phaseId={reviewSheetPhaseId} />
      ) : (
        <ProposalSheet />
      )}
    </ProposalSheetProvider>
  );
}

function DecisionPage({
  instance,
  slug,
  decisionSlug,
}: {
  instance: Instance;
  slug: string;
  decisionSlug?: string;
}) {
  const instanceId = instance.id;
  const { currentStateId } = instance;
  const phases = instance.instanceData?.phases ?? [];
  const currentPhase = phases.find((p) => p.phaseId === currentStateId);
  const isVotingEnabled = !!currentPhase && isVotingPhase(currentPhase);
  const isReviewEnabled = !!currentPhase && isReviewPhase(currentPhase);
  const isAdmin = Boolean(instance.access?.admin);

  if (!instance.selectionsAreConfirmed) {
    // The current phase has an empty inbound transition awaiting selection.
    // When the *previous* phase was a review phase, an admin can advance
    // proposals using rich review aggregates — that's the ReviewSelection view.
    // Everyone else falls back to the generic manual-selection prompt.
    const currentIdx = phases.findIndex((p) => p.phaseId === currentStateId);
    const previousPhase = currentIdx > 0 ? phases[currentIdx - 1] : null;
    const previousWasReview = !!previousPhase && isReviewPhase(previousPhase);

    if (previousWasReview && previousPhase && isAdmin) {
      return (
        <ReviewSelectionPage
          instance={instance}
          previousPhaseId={previousPhase.phaseId}
        />
      );
    }
    // Last-phase manual selection: admin is confirming the final winners.
    // Uses a Figma-specific hero but keeps the generic selection table below.
    if (isLastPhase(currentStateId, phases) && isAdmin && decisionSlug) {
      return (
        <FinalPhaseManualSelectionPage
          instanceId={instanceId}
          decisionSlug={decisionSlug}
        />
      );
    }
    return (
      <StandardDecisionPage
        instanceId={instanceId}
        slug={slug}
        decisionSlug={decisionSlug}
        pinOffset={DECISION_VIEW_PIN_OFFSET}
      />
    );
  }

  if (isReviewEnabled) {
    if (!decisionSlug) {
      notFound();
    }
    return (
      <ReviewPage
        instance={instance}
        decisionSlug={decisionSlug}
        slug={slug}
        pinOffset={DECISION_VIEW_PIN_OFFSET}
      />
    );
  }

  if (isVotingEnabled) {
    return (
      <VotingPage
        instanceId={instanceId}
        slug={slug}
        decisionSlug={decisionSlug}
        pinOffset={DECISION_VIEW_PIN_OFFSET}
      />
    );
  }

  const hasActiveCapabilities = currentPhase?.rules?.proposals?.submit === true;

  if (isLastPhase(currentStateId, phases) && !hasActiveCapabilities) {
    return (
      <ResultsPage
        instanceId={instanceId}
        profileSlug={slug}
        decisionSlug={decisionSlug}
        pinOffset={DECISION_VIEW_PIN_OFFSET}
      />
    );
  }

  return (
    <StandardDecisionPage
      instanceId={instanceId}
      slug={slug}
      decisionSlug={decisionSlug}
      pinOffset={DECISION_VIEW_PIN_OFFSET}
    />
  );
}

export function DecisionStateRouter({
  instanceId,
  slug,
  decisionSlug,
  useLegacy = false,
}: {
  instanceId: string;
  slug: string;
  /** Decision profile slug for building proposal links */
  decisionSlug?: string;
  /** Use legacy getInstance endpoint (for /profile/[slug]/decisions/[id] route) */
  useLegacy?: boolean;
}) {
  if (!useLegacy) {
    return (
      <DecisionStateRouterNew
        instanceId={instanceId}
        slug={slug}
        decisionSlug={decisionSlug}
      />
    );
  }

  return (
    <ProposalSheetProvider
      slug={slug}
      instanceId={instanceId}
      decisionSlug={decisionSlug}
    >
      <DecisionStateRouterLegacy instanceId={instanceId} slug={slug} />
      <ProposalSheet />
    </ProposalSheetProvider>
  );
}
