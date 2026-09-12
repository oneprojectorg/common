'use client';

import { ResourceErrorBoundary } from '@/utils/ResourceErrorBoundary';
import { useTRPC } from '@op/api/client';
import { useSuspenseQueries } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';
import { DocumentNotAvailable } from '@/components/decisions/DocumentNotAvailable';
import { ProposalEditor } from '@/components/decisions/proposalEditor';

function ProposalEditPageContent({
  profileId,
  instanceId,
  decisionSlug,
}: {
  profileId: string;
  instanceId: string;
  decisionSlug: string;
}) {
  const trpc = useTRPC();
  // Get both the proposal and the instance in parallel
  const [{ data: proposal }, { data: instance }] = useSuspenseQueries({
    queries: [
      trpc.decision.getProposal.queryOptions({ profileId }),
      trpc.decision.getInstance.queryOptions({ instanceId }),
    ],
  });

  if (!proposal || !instance) {
    notFound();
  }

  const backHref = `/decisions/${decisionSlug}/current`;

  return (
    <ProposalEditor
      instance={instance}
      backHref={backHref}
      proposal={proposal}
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
        <div className="mx-auto max-w-xl space-y-6">
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

export const LegacyProposalEditClient = ({
  profileId,
  instanceId,
  decisionSlug,
}: {
  profileId: string;
  instanceId: string;
  decisionSlug: string;
}) => {
  return (
    <ErrorBoundary fallback={<DocumentNotAvailable />}>
      <Suspense fallback={<ProposalEditPageSkeleton />}>
        {/* Intercept 404/403 first (missing/forbidden proposal → accurate
            status page); any other error falls through to DocumentNotAvailable. */}
        <ResourceErrorBoundary>
          <ProposalEditPageContent
            profileId={profileId}
            instanceId={instanceId}
            decisionSlug={decisionSlug}
          />
        </ResourceErrorBoundary>
      </Suspense>
    </ErrorBoundary>
  );
};
