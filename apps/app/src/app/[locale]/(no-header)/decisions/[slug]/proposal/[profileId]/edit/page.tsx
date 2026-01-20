'use client';

import { trpc } from '@op/api/client';
import { notFound, useParams } from 'next/navigation';
import { Suspense } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';
import { ProposalEditor } from '@/components/decisions/ProposalEditor';

function ProposalEditPageContent({
  profileId,
  slug,
}: {
  profileId: string;
  slug: string;
}) {
  // Get the decision profile to find the instance ID
  const [decisionProfile] = trpc.decision.getDecisionBySlug.useSuspenseQuery({
    slug,
  });

  if (!decisionProfile?.processInstance) {
    notFound();
  }

  const instanceId = decisionProfile.processInstance.id;

  // Get both the proposal and the instance in parallel
  const [[proposal, instance]] = trpc.useSuspenseQueries((t) => [
    t.decision.getProposal({ profileId }),
    t.decision.getInstance({ instanceId }),
  ]);

  if (!proposal || !instance) {
    notFound();
  }

  const backHref = `/decisions/${slug}`;

  return (
    <ProposalEditor
      instance={instance}
      backHref={backHref}
      existingProposal={proposal}
      isEditMode={true}
    />
  );
}

function ProposalEditPageSkeleton() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header loading */}
      <div className="flex items-center justify-between border-b bg-white px-6 py-4">
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
  const { profileId, slug } = useParams<{
    profileId: string;
    slug: string;
  }>();

  return (
    <ErrorBoundary>
      <Suspense fallback={<ProposalEditPageSkeleton />}>
        <ProposalEditPageContent profileId={profileId} slug={slug} />
      </Suspense>
    </ErrorBoundary>
  );
};

export default ProposalEditPage;
