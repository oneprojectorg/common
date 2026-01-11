'use client';

import { trpc } from '@op/api/client';
import { notFound, useParams } from 'next/navigation';
import { Suspense } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';
import { ProposalEditor } from '@/components/decisions/ProposalEditor';

function ProposalEditPageContent({
  profileId,
  instanceId,
  slug,
}: {
  profileId: string;
  instanceId: string;
  slug: string;
}) {
  // Get both the proposal and the instance in parallel
  const [[proposal, instance]] = trpc.useSuspenseQueries((t) => [
    t.decision.getProposal({ profileId }),
    t.decision.getInstance({ instanceId }),
  ]);

  if (!proposal || !instance) {
    notFound();
  }

  return (
    <ProposalEditor
      instance={instance}
      backHref={`/profile/${slug}/decisions/${instanceId}/proposal/${profileId}`}
      existingProposal={proposal}
      isEditMode={true}
    />
  );
}

function ProposalEditPageSkeleton() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header loading */}
      <div className="px-6 py-4 flex items-center justify-between border-b bg-white">
        <div className="h-6 w-32 bg-gray-200 animate-pulse rounded" />
        <div className="h-6 w-48 bg-gray-200 animate-pulse rounded" />
        <div className="h-10 w-24 bg-gray-200 animate-pulse rounded" />
      </div>

      {/* Content loading */}
      <div className="px-6 py-8 flex-1 bg-white">
        <div className="max-w-4xl space-y-6 mx-auto">
          <div className="h-12 w-96 bg-gray-200 animate-pulse rounded" />
          <div className="gap-4 flex">
            <div className="h-8 w-32 bg-gray-200 animate-pulse rounded" />
            <div className="h-8 w-28 bg-gray-200 animate-pulse rounded" />
          </div>
          <div className="h-96 bg-gray-200 animate-pulse w-full rounded" />
        </div>
      </div>
    </div>
  );
}

const ProposalEditPage = () => {
  const { profileId, id, slug } = useParams<{
    profileId: string;
    id: string;
    slug: string;
  }>();

  return (
    <ErrorBoundary>
      <Suspense fallback={<ProposalEditPageSkeleton />}>
        <ProposalEditPageContent
          profileId={profileId}
          instanceId={id}
          slug={slug}
        />
      </Suspense>
    </ErrorBoundary>
  );
};

export default ProposalEditPage;
