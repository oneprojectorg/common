import { trpcNext } from '@op/api/vanilla';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { ProposalEditor } from '@/components/decisions/ProposalEditor';

async function ProposalEditPageContent({
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
    
    // Get both the proposal and the instance
    const [proposal, instance] = await Promise.all([
      client.decision.getProposal.query({ proposalId }),
      client.decision.getInstance.query({ instanceId }),
    ]);

    if (!proposal || !instance) {
      notFound();
    }

    return (
      <ProposalEditor
        instance={instance}
        backHref={`/profile/${slug}/decisions/${instanceId}/proposal/${proposalId}`}
        existingProposal={proposal}
        isEditMode={true}
      />
    );
  } catch (error) {
    console.error('Error loading proposal for editing:', error);
    notFound();
  }
}

function ProposalEditPageSkeleton() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header loading */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
        <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-10 w-24 animate-pulse rounded bg-gray-200" />
      </div>

      {/* Content loading */}
      <div className="flex-1 bg-white px-6 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="h-12 w-96 animate-pulse rounded bg-gray-200" />
          <div className="flex gap-4">
            <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
            <div className="h-8 w-28 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="h-96 w-full animate-pulse rounded bg-gray-200" />
        </div>
      </div>
    </div>
  );
}

const ProposalEditPage = async ({
  params,
}: {
  params: Promise<{ proposalId: string; id: string; slug: string }>;
}) => {
  const { proposalId, id, slug } = await params;

  return (
    <Suspense fallback={<ProposalEditPageSkeleton />}>
      <ProposalEditPageContent
        proposalId={proposalId}
        instanceId={id}
        slug={slug}
      />
    </Suspense>
  );
};

export default ProposalEditPage;