'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { trpc } from '@op/api/client';
import { isLastPhase } from '@op/common/client';
import { notFound } from 'next/navigation';

import { ResultsPage } from './pages/ResultsPage';
import { ReviewPage } from './pages/ReviewPage';
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

  if (isReviewEnabled && reviewFlowEnabled) {
    if (!decisionSlug) {
      notFound();
    }
    return <ReviewPage instance={instance} decisionSlug={decisionSlug} />;
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

  const hasActiveCapabilities =
    isVotingEnabled || currentPhase?.rules?.proposals?.submit === true;

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
