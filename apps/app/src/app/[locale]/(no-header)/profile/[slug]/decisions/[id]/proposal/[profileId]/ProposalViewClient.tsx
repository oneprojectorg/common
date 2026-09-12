'use client';
import { ResourceErrorBoundary } from '@/utils/ResourceErrorBoundary';
import { useTRPC } from '@op/api/client';
import { useSuspenseQuery } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { ProposalView } from '@/components/decisions/ProposalView';
import { ProposalViewSkeleton } from '@/components/decisions/ProposalViewSkeleton';
import { NO_PROPOSAL_AFFORDANCES } from '@/components/decisions/getProposalAffordances';

function ProposalViewPageContent({
  profileId,
  orgSlug,
  instanceId,
}: {
  profileId: string;
  orgSlug: string;
  instanceId: string;
}) {
  const trpc = useTRPC();
  // Legacy decision boundary — still served via shared public links.
  // Revisions aren't available on legacy instances, so the instance fetch
  // isn't needed.
  const { data: proposal } = useSuspenseQuery(
    trpc.decision.getProposal.queryOptions({ profileId }),
  );

  if (!proposal) {
    notFound();
  }

  const decisionRoot = `/profile/${orgSlug}/decisions/${instanceId}`;

  return (
    <ProposalView
      proposal={proposal}
      affordances={NO_PROPOSAL_AFFORDANCES}
      // A legacy instance has no revision cycle at all.
      isAuthor={false}
      currentPhaseId={null}
      decisionRoot={decisionRoot}
      selection={null}
    />
  );
}

export const LegacyProposalViewClient = ({
  profileId,
  orgSlug,
  instanceId,
}: {
  profileId: string;
  orgSlug: string;
  instanceId: string;
}) => {
  return (
    <ResourceErrorBoundary>
      <Suspense fallback={<ProposalViewSkeleton />}>
        <ProposalViewPageContent
          profileId={profileId}
          orgSlug={orgSlug}
          instanceId={instanceId}
        />
      </Suspense>
    </ResourceErrorBoundary>
  );
};
