'use client';

import { trpc } from '@op/api/client';
import { match } from '@op/core';

import { ResultsPage } from './pages/ResultsPage';
import { StandardDecisionPage } from './pages/StandardDecisionPage';
import { VotingPage } from './pages/VotingPage';

interface DecisionStateRouterProps {
  instanceId: string;
  slug: string;
}

export function DecisionStateRouter({
  instanceId,
  slug,
}: DecisionStateRouterProps) {
  const [[instance]] = trpc.useSuspenseQueries((t) => [
    t.decision.getInstance({
      instanceId,
    }),
  ]);

  const currentStateId = instance.currentStateId;

  return match(currentStateId, {
    results: () => <ResultsPage instanceId={instanceId} slug={slug} />,
    voting: () => <VotingPage instanceId={instanceId} slug={slug} />,
    _: () => <StandardDecisionPage instanceId={instanceId} slug={slug} />,
  });
}
