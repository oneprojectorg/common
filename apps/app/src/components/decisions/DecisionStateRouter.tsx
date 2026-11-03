'use client';

import { trpc } from '@op/api/client';
import { isLastPhase, isReviewPhase, isVotingPhase } from '@op/common/client';
import { notFound } from 'next/navigation';

import { ProposalSheetProvider } from './ProposalSheetProvider';
import { FinalPhaseManualSelectionPage } from './pages/FinalPhaseManualSelectionPage';
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
}: {
  instanceId: string;
  slug: string;
  decisionSlug?: string;
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
      />
    );
  }

  if (isReviewEnabled) {
    if (!decisionSlug) {
      notFound();
    }
    return (
      <ReviewPage instance={instance} decisionSlug={decisionSlug} slug={slug} />
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
  return (
    <ProposalSheetProvider
      slug={slug}
      instanceId={instanceId}
      decisionSlug={decisionSlug}
    >
      {useLegacy ? (
        <DecisionStateRouterLegacy instanceId={instanceId} slug={slug} />
      ) : (
        <DecisionStateRouterNew
          instanceId={instanceId}
          slug={slug}
          decisionSlug={decisionSlug}
        />
      )}
    </ProposalSheetProvider>
  );
}
