'use client';

import { trpc } from '@op/api/client';
import { useSuspenseQueries } from '@tanstack/react-query';
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
  const results = useSuspenseQueries({
    queries: [
      {
        queryKey: [['decision', 'getProposal'], { input: { profileId } }],
        queryFn: () => trpc.decision.getProposal.query({ profileId }),
      },
      {
        queryKey: [['decision', 'getInstance'], { input: { instanceId } }],
        queryFn: () => trpc.decision.getInstance.query({ instanceId }),
      },
    ],
  });

  const proposal = results[0].data;
  const instance = results[1].data;

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
