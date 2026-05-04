'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { trpc } from '@op/api/client';
import { isLastPhase } from '@op/common/client';
import { notFound } from 'next/navigation';

import { ResultsPage } from './pages/ResultsPage';
import { ReviewPage } from './pages/ReviewPage';
import { ReviewSelectionPage } from './pages/ReviewSelectionPage';
import { StandardDecisionPage } from './pages/StandardDecisionPage';
import { VotingPage } from './pages/VotingPage';

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
  const reviewFlowEnabled = useFeatureFlag('review_flow');

  const { currentStateId } = instance;
  const phases = instance.instanceData?.phases ?? [];
  const currentPhase = phases.find((p) => p.phaseId === currentStateId);
  const isVotingEnabled = currentPhase?.rules?.voting?.submit === true;
  const isReviewEnabled = currentPhase?.rules?.proposals?.review === true;
  const isAdmin = Boolean(instance.access?.admin);

  if (!instance.selectionsAreConfirmed) {
    // The current phase has an empty inbound transition awaiting selection.
    // When the *previous* phase was a review phase, an admin can advance
    // proposals using rich review aggregates — that's the ReviewSelection view.
    // Everyone else falls back to the generic manual-selection prompt.
    const currentIdx = phases.findIndex((p) => p.phaseId === currentStateId);
    const previousPhase = currentIdx > 0 ? phases[currentIdx - 1] : null;
    const previousWasReview =
      previousPhase?.rules?.proposals?.review === true && reviewFlowEnabled;

    if (previousWasReview && previousPhase && isAdmin) {
      return (
        <ReviewSelectionPage
          instance={instance}
          previousPhaseId={previousPhase.phaseId}
        />
      );
    }
    return (
      <StandardDecisionPage
        instanceId={instanceId}
        slug={slug}
        decisionSlug={decisionSlug}
        decisionProfileId={decisionProfileId}
      />
    );
  }

  if (isReviewEnabled && reviewFlowEnabled) {
    if (!decisionSlug) {
      notFound();
    }
    return (
      <ReviewPage
        instance={instance}
        decisionSlug={decisionSlug}
        slug={slug}
        decisionProfileId={decisionProfileId}
      />
    );
  }

  if (isVotingEnabled) {
    return (
      <VotingPage
        instanceId={instanceId}
        slug={slug}
        decisionSlug={decisionSlug}
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
      />
    );
  }

  return (
    <StandardDecisionPage
      instanceId={instanceId}
      slug={slug}
      decisionSlug={decisionSlug}
      decisionProfileId={decisionProfileId}
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
