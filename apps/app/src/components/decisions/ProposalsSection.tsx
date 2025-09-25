import { trpcNext } from '@op/api/vanilla';
import { Suspense } from 'react';

import { EmptyProposalsState } from '@/components/decisions/EmptyProposalsState';
import { ProposalsList, ProposalListSkeleton } from '@/components/decisions/ProposalsList';

interface ProposalsSectionProps {
  instanceId: string;
  slug: string;
}

async function ProposalsContent({ instanceId, slug }: ProposalsSectionProps) {
  const client = await trpcNext();

  const proposalsData = await client.decision.listProposals.query({
    processInstanceId: instanceId,
    limit: 100,
  });

  const proposals = proposalsData?.proposals || [];

  return (
    <div className="lg:col-span-3">
      {proposals.length === 0 ? (
        <EmptyProposalsState />
      ) : (
        <Suspense fallback={<ProposalListSkeleton />}>
          <ProposalsList slug={slug} instanceId={instanceId} />
        </Suspense>
      )}
    </div>
  );
}

export function ProposalsSection({ instanceId, slug }: ProposalsSectionProps) {
  return (
    <div className="flex w-full justify-center bg-white">
      <div className="w-full gap-8 p-4 sm:max-w-6xl sm:p-8">
        <Suspense fallback={<ProposalListSkeleton />}>
          <ProposalsContent instanceId={instanceId} slug={slug} />
        </Suspense>
      </div>
    </div>
  );
}