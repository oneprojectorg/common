'use client';

import { ResourceErrorBoundary } from '@/utils/ResourceErrorBoundary';
import { trpc } from '@op/api/client';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { ProposalView } from '@/components/decisions/ProposalView';
import { ProposalViewSkeleton } from '@/components/decisions/ProposalViewSkeleton';
import { NO_PROPOSAL_REVIEW_VISIBILITY } from '@/components/decisions/getProposalReviewVisibility';

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

  return (
    <ProposalView
      proposal={proposal}
      visibility={NO_PROPOSAL_REVIEW_VISIBILITY}
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
