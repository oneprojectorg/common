import { trpcNext } from '@op/api/vanilla';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { ProposalView } from '@/components/decisions/ProposalView';

async function ProposalViewPageContent({
  proposalId,
  instanceId,
  slug,
}: {
  proposalId: string;
  instanceId: string;
  slug: string;
}) {
  try {
    const client = await trpcNext();
    const proposal = await client.decision.getProposal.query({
      proposalId,
    });

    if (!proposal) {
      notFound();
    }

    return (
      <ProposalView
        proposal={proposal}
        backHref={`/profile/${slug}/decisions/${instanceId}`}
      />
    );
  } catch (error) {
    console.error('Error loading proposal:', error);
    notFound();
  }
}

function ProposalViewPageSkeleton() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header loading */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
        <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
        <div className="flex items-center gap-3">
          <div className="h-10 w-20 animate-pulse rounded bg-gray-200" />
          <div className="h-10 w-24 animate-pulse rounded bg-gray-200" />
          <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
        </div>
      </div>

      {/* Content loading */}
      <div className="flex-1 bg-white px-6 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="h-12 w-96 animate-pulse rounded bg-gray-200" />
          <div className="flex gap-4">
            <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
            <div className="h-8 w-28 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
            <div className="space-y-1">
              <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
            </div>
          </div>
          <div className="flex gap-6 border-b border-gray-200 pb-4">
            <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-18 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="mt-6 space-y-4">
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      </div>
    </div>
  );
}

const ProposalViewPage = async ({
  params,
}: {
  params: Promise<{ proposalId: string; id: string; slug: string }>;
}) => {
  const { proposalId, id, slug } = await params;

  return (
    <Suspense fallback={<ProposalViewPageSkeleton />}>
      <ProposalViewPageContent
        proposalId={proposalId}
        instanceId={id}
        slug={slug}
      />
    </Suspense>
  );
};

export default ProposalViewPage;