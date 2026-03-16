'use client';

import { trpc } from '@op/api/client';
import { type InstancePhaseData } from '@op/api/encoders';
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
  decisionProfileId,
}: {
  instanceId: string;
  slug: string;
  decisionSlug?: string;
  decisionProfileId?: string | null;
}) {
  const t = useTranslations();
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });

  const { currentStateId } = instance;

  // Derive values for StandardDecisionPage (format-agnostic)
  const phases = instance.instanceData.phases ?? [];
  const currentPhaseId = instance.instanceData.currentPhaseId;
  const currentPhase = phases.find(
    (phase): phase is InstancePhaseData => phase.phaseId === currentPhaseId,
  );
  const allowProposals = currentPhase?.rules?.proposals?.submit !== false;
  const description = instance?.description?.match('PPDESCRIPTION')
    ? t('PPDESCRIPTION')
    : (instance.description ??
      instance.instanceData.templateDescription ??
      undefined);

  const canSubmitProposal = instance.access?.submitProposals ?? false;
  const canVote = instance.access?.vote ?? false;
  const canManage = instance.access?.admin ?? false;

  return match(currentStateId, {
    results: () => <ResultsPage instanceId={instanceId} slug={slug} />,
    voting: () => (
      <VotingPage
        instanceId={instanceId}
        slug={slug}
        decisionSlug={decisionSlug}
        canVote={canVote}
        canManageProposals={canManage}
      />
    ),
    _: () => (
      <StandardDecisionPage
        instanceId={instanceId}
        slug={slug}
        decisionSlug={decisionSlug}
        decisionProfileId={decisionProfileId}
        allowProposals={allowProposals}
        description={description}
        currentPhase={currentPhase}
        canSubmitProposal={canSubmitProposal}
        canManageProposals={canManage}
      />
    ),
  });
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
