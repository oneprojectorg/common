'use client';

import { trpc } from '@op/api/client';
import { match } from '@op/core';

import { ResultsPage } from './pages/ResultsPage';
import { StandardDecisionPage } from './pages/StandardDecisionPage';
import { VotingPage } from './pages/VotingPage';

export function DecisionStateRouter({
  instanceId,
  slug,
}: {
  instanceId: string;
  slug: string;
}) {
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({
    instanceId,
  });

  const { currentStateId } = instance;


  return match(currentStateId, {
    results: () => <ResultsPage instanceId={instanceId} slug={slug} />,
    voting: () => <VotingPage instanceId={instanceId} slug={slug} />,
    _: () => <StandardDecisionPage instanceId={instanceId} slug={slug} />,
  });
}
