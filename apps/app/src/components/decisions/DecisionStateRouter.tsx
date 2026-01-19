'use client';

import { trpc } from '@op/api/client';
import { match } from '@op/core';

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
}: {
  instanceId: string;
  slug: string;
}) {
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });

  const { currentStateId } = instance;

  return match(currentStateId, {
    results: () => <ResultsPage instanceId={instanceId} slug={slug} />,
    voting: () => <VotingPage instanceId={instanceId} slug={slug} />,
    _: () => <StandardDecisionPage instanceId={instanceId} slug={slug} />,
  });
}

export function DecisionStateRouter({
  instanceId,
  slug,
  useLegacy = false,
}: {
  instanceId: string;
  slug: string;
  /** Use legacy getInstance endpoint (for /profile/[slug]/decisions/[id] route) */
  useLegacy?: boolean;
}) {
  if (useLegacy) {
    return <DecisionStateRouterLegacy instanceId={instanceId} slug={slug} />;
  }
  return <DecisionStateRouterNew instanceId={instanceId} slug={slug} />;
}
