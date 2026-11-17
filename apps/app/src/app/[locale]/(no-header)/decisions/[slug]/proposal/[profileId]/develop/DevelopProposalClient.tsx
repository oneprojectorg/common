'use client';

import { ResourceErrorBoundary } from '@/utils/ResourceErrorBoundary';
import { trpc } from '@op/api/client';
import { notFound } from 'next/navigation';

import { DevelopProposalRoute } from '@/components/decisions/developProposalEditor/DevelopProposalRoute';

export function DevelopProposalClient({
  profileId,
  slug,
}: {
  profileId: string;
  slug: string;
}) {
  // Translates NOT_FOUND and FORBIDDEN from the suspense queries to 404/403.
  return (
    <ResourceErrorBoundary>
      <DevelopProposalClientContent profileId={profileId} slug={slug} />
    </ResourceErrorBoundary>
  );
}

function DevelopProposalClientContent({
  profileId,
  slug,
}: {
  profileId: string;
  slug: string;
}) {
  const [[decisionProfile, proposal]] = trpc.useSuspenseQueries((t) => [
    t.decision.getDecisionBySlug({ slug }),
    t.decision.getProposal({ profileId }),
  ]);

  if (!decisionProfile?.processInstance || !proposal) {
    notFound();
  }

  return (
    <DevelopProposalRoute
      instance={decisionProfile.processInstance}
      proposal={proposal}
      decisionSlug={slug}
    />
  );
}
