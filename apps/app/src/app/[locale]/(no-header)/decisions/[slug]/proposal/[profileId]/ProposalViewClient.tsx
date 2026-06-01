'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { isLastPhase } from '@op/common/client';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { ProposalView } from '@/components/decisions/ProposalView';

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
  const currentPhase = phases.find(
    (phase) => phase.phaseId === instance.currentStateId,
  );
  const isInReviewPhase = currentPhase?.rules?.proposals?.review === true;
  const isAuthor =
    !!user.currentProfile?.id &&
    proposal.submittedBy?.id === user.currentProfile.id;
  // Author, admin, or explicit review access — only in a review phase.
  const canSeeRevisions =
    isInReviewPhase &&
    (isAuthor ||
      instance.access?.admin === true ||
      instance.access?.review === true);

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
      canSeeRevisions={canSeeRevisions}
      backHref={`/decisions/${slug}`}
      selection={selection ?? null}
    />
  );
}

function ProposalViewPageSkeleton() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header loading */}
      <div className="flex items-center justify-between border-b bg-white px-6 py-4">
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
          <div className="flex gap-6 border-b pb-4">
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

export const ProposalViewClient = ({
  profileId,
  slug,
}: {
  profileId: string;
  slug: string;
}) => {
  return (
    <APIErrorBoundary
      fallbacks={{
        404: () => notFound(),
      }}
    >
      <Suspense fallback={<ProposalViewPageSkeleton />}>
        <ProposalViewPageContent profileId={profileId} slug={slug} />
      </Suspense>
    </APIErrorBoundary>
  );
};
