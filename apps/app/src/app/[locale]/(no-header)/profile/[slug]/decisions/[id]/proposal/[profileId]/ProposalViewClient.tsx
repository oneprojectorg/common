'use client';

import { ResourceErrorBoundary } from '@/utils/ResourceErrorBoundary';
import { trpc } from '@op/api/client';
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
  // Legacy decision boundary — still served via shared public links.
  // Revisions aren't available on legacy instances, so the instance fetch
  // isn't needed.
  const [proposal] = trpc.decision.getProposal.useSuspenseQuery({ profileId });

  if (!proposal) {
    notFound();
  }

  const decisionRoot = `/profile/${orgSlug}/decisions/${instanceId}`;

  // Comments fall back to allowed here: legacy phases carry no `comments` rule,
  // and neither endpoint reports one — `getLegacyInstance` drops phase rules at
  // its encoder and needs auth (these links are public), `getInstance` parses
  // new-schema instances only.
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
