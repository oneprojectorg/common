'use client';

import { trpc } from '@op/api/client';
import { match } from '@op/core';

import { useTranslations } from '@/lib/i18n/routing';

import { ResultsPage } from './pages/ResultsPage';
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
  return <ResultsPage instanceId={instanceId} slug={slug} useLegacy />;
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
  const t = useTranslations();
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });

  const { currentStateId } = instance;

  // Derive values for StandardDecisionPage (format-agnostic)
  const phases = instance.instanceData.phases ?? [];
  const currentPhaseId = instance.instanceData.currentPhaseId;
  const currentPhase = phases.find((phase) => phase.phaseId === currentPhaseId);
  const allowProposals = currentPhase?.rules?.proposals?.submit !== false;
  const description = instance?.description?.match('PPDESCRIPTION')
    ? t('PPDESCRIPTION')
    : (instance.description ??
      instance.instanceData.templateDescription ??
      undefined);
  const maxVotesPerMember = instance?.instanceData?.fieldValues
    ?.maxVotesPerMember as number | undefined;

  return match(currentStateId, {
    results: () => <ResultsPage instanceId={instanceId} slug={slug} />,
    voting: () => (
      <VotingPage
        instanceId={instanceId}
        slug={slug}
        decisionSlug={decisionSlug}
      />
    ),
    _: () => (
      <StandardDecisionPage
        instanceId={instanceId}
        slug={slug}
        decisionSlug={decisionSlug}
        allowProposals={allowProposals}
        description={description}
        currentPhaseId={currentPhaseId}
        maxVotesPerMember={maxVotesPerMember}
      />
    ),
  });
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
  if (useLegacy) {
    return <DecisionStateRouterLegacy instanceId={instanceId} slug={slug} />;
  }
  return (
    <DecisionStateRouterNew
      instanceId={instanceId}
      slug={slug}
      decisionSlug={decisionSlug}
    />
  );
}
