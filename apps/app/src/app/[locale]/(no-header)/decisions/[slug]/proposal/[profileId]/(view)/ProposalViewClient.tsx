'use client';

import { ResourceErrorBoundary } from '@/utils/ResourceErrorBoundary';
import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { isLastPhase } from '@op/common/client';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { ProposalView } from '@/components/decisions/ProposalView';
import { ProposalViewSkeleton } from '@/components/decisions/ProposalViewSkeleton';
import { getProposalAffordances } from '@/components/decisions/getProposalAffordances';

function ProposalViewPageContent({
  profileId,
  slug,
}: {
  profileId: string;
  slug: string;
}) {
  const [[proposal, decisionProfile]] = trpc.useSuspenseQueries((t) => [
    t.decision.getProposal({ profileId }),
    t.decision.getDecisionBySlug({ slug }),
  ]);

  if (!proposal) {
    notFound();
  }

  const instance = decisionProfile.processInstance;
  const { user } = useUser();

  const phases = instance.instanceData?.phases ?? [];
  const affordances = getProposalAffordances({ instance, proposal, user });

  // Selections only make sense once we've reached the final/results phase.
  const inLastPhase = isLastPhase(instance.currentStateId, phases);
  const { data: selection } =
    trpc.decision.getLatestSelectionForProposal.useQuery(
      { proposalId: proposal.id },
      { enabled: inLastPhase },
    );

  return (
    <ProposalView
      proposal={proposal}
      affordances={affordances}
      decisionRoot={`/decisions/${slug}`}
      selection={selection ?? null}
    />
  );
}

export const ProposalViewClient = ({
  profileId,
  slug,
}: {
  profileId: string;
  slug: string;
}) => {
  return (
    <ResourceErrorBoundary>
      <Suspense fallback={<ProposalViewSkeleton />}>
        <ProposalViewPageContent profileId={profileId} slug={slug} />
      </Suspense>
    </ResourceErrorBoundary>
  );
};
