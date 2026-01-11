'use client';

import { trpc } from '@op/api/client';
import { notFound, useParams } from 'next/navigation';
import { Suspense } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';
import { ProposalView } from '@/components/decisions/ProposalView';

function ProposalViewPageContent({
  profileId,
  instanceId,
  slug,
}: {
  profileId: string;
  instanceId: string;
  slug: string;
}) {
  const [proposal] = trpc.decision.getProposal.useSuspenseQuery({
    profileId,
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
}

function ProposalViewPageSkeleton() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header loading */}
      <div className="px-6 py-4 flex items-center justify-between border-b bg-white">
        <div className="h-6 w-32 bg-gray-200 animate-pulse rounded" />
        <div className="h-6 w-48 bg-gray-200 animate-pulse rounded" />
        <div className="gap-3 flex items-center">
          <div className="h-10 w-20 bg-gray-200 animate-pulse rounded" />
          <div className="h-10 w-24 bg-gray-200 animate-pulse rounded" />
          <div className="h-8 w-8 bg-gray-200 animate-pulse rounded-full" />
        </div>
      </div>

      {/* Content loading */}
      <div className="px-6 py-8 flex-1 bg-white">
        <div className="max-w-4xl space-y-6 mx-auto">
          <div className="h-12 w-96 bg-gray-200 animate-pulse rounded" />
          <div className="gap-4 flex">
            <div className="h-8 w-32 bg-gray-200 animate-pulse rounded" />
            <div className="h-8 w-28 bg-gray-200 animate-pulse rounded" />
          </div>
          <div className="gap-3 flex items-center">
            <div className="h-8 w-8 bg-gray-200 animate-pulse rounded-full" />
            <div className="space-y-1">
              <div className="h-4 w-32 bg-gray-200 animate-pulse rounded" />
              <div className="h-3 w-24 bg-gray-200 animate-pulse rounded" />
            </div>
          </div>
          <div className="gap-6 pb-4 flex border-b">
            <div className="h-4 w-16 bg-gray-200 animate-pulse rounded" />
            <div className="h-4 w-20 bg-gray-200 animate-pulse rounded" />
            <div className="h-4 bg-gray-200 animate-pulse w-18 rounded" />
          </div>
          <div className="mt-6 space-y-4">
            <div className="h-4 bg-gray-200 animate-pulse w-full rounded" />
            <div className="h-4 bg-gray-200 animate-pulse w-3/4 rounded" />
            <div className="h-4 bg-gray-200 animate-pulse w-5/6 rounded" />
            <div className="h-4 bg-gray-200 animate-pulse w-1/2 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

const ProposalViewPage = () => {
  const { profileId, id, slug } = useParams<{
    profileId: string;
    id: string;
    slug: string;
  }>();

  return (
    <ErrorBoundary>
      <Suspense fallback={<ProposalViewPageSkeleton />}>
        <ProposalViewPageContent
          profileId={profileId}
          instanceId={id}
          slug={slug}
        />
      </Suspense>
    </ErrorBoundary>
  );
};

export default ProposalViewPage;
