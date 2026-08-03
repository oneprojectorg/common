'use client';

import { trpc } from '@op/api/client';
import {
  getPreviousPhase,
  isLastPhase,
  isReviewPhase,
  isVotingPhase,
} from '@op/common/client';
import { notFound } from 'next/navigation';

import { FinalPhaseManualSelectionPage } from './pages/FinalPhaseManualSelectionPage';
import { ResultsPage } from './pages/ResultsPage';
import { ReviewPage } from './pages/ReviewPage';
import { ReviewSelectionPage } from './pages/ReviewSelectionPage';
import { StandardDecisionPage } from './pages/StandardDecisionPage';
import { VotingPage } from './pages/VotingPage';

// Sticky filter-bar pin offset (px) for the decision-view layout — the clearance
// below the scroll container's top for the floating Overview/Current toggle that
// overhangs the header bottom on mobile. The bar pins just under the toggle;
// content above the bar (the phase header) scrolls up behind the toggle.
// The legacy /profile route has no toggle and falls back to the bar's 0 default.
const DECISION_VIEW_PIN_OFFSET = 50;

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

function DecisionStateRouterNew({
  instanceId,
  slug,
  decisionSlug,
  decisionProfileId,
}: {
  instanceId: string;
  slug: string;
  decisionSlug?: string;
  decisionProfileId?: string | null;
}) {
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });

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
    const previousPhase = getPreviousPhase({ phases }, currentStateId);
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
        decisionProfileId={decisionProfileId}
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
        decisionProfileId={decisionProfileId}
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
      decisionProfileId={decisionProfileId}
      pinOffset={DECISION_VIEW_PIN_OFFSET}
    />
  );
}

export function DecisionStateRouter({
  instanceId,
  slug,
  decisionSlug,
  decisionProfileId,
  useLegacy = false,
}: {
  instanceId: string;
  slug: string;
  /** Decision profile slug for building proposal links */
  decisionSlug?: string;
  /** Decision profile ID for translating the decision content */
  decisionProfileId?: string | null;
  /** Use legacy getInstance endpoint (for /profile/[slug]/decisions/[id] route) */
  useLegacy?: boolean;
}) {
  if (useLegacy) {
    return <DecisionStateRouterLegacy instanceId={instanceId} slug={slug} />;
  }
  return (
    <DecisionStateRouterNew
      instanceId={instanceId}
      slug={slug}
      decisionSlug={decisionSlug}
      decisionProfileId={decisionProfileId}
    />
  );
}
