'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import type { Proposal } from '@op/common/client';
import { notFound, useParams } from 'next/navigation';
import { Suspense } from 'react';

import { ProposalView } from '@/components/decisions/ProposalView';

const LEGACY_ORG_SLUGS = ['people-powered', 'cowop', 'one-project'];

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

  const ownerSlug = decisionProfile?.processInstance?.owner?.slug;
  const instanceId = decisionProfile?.processInstance?.id;

  // Legacy orgs still own pre-v2 state-based instances that getInstance can't
  // parse. Detect them at the path boundary and route through the legacy
  // endpoint, mirroring the pattern in DecisionHeader / ResultsPage.
  const useLegacy = !!ownerSlug && LEGACY_ORG_SLUGS.includes(ownerSlug);

  const backHref =
    useLegacy && instanceId
      ? `/profile/${ownerSlug}/decisions/${instanceId}/`
      : `/decisions/${slug}`;

  if (useLegacy) {
    return (
      <ProposalView
        proposal={proposal}
        canSeeRevisions={false}
        backHref={backHref}
      />
    );
  }

  return (
    <NewInstanceProposalView
      proposal={proposal}
      instanceId={proposal.processInstanceId}
      backHref={backHref}
    />
  );
}

function NewInstanceProposalView({
  proposal,
  instanceId,
  backHref,
}: {
  proposal: Proposal;
  instanceId: string;
  backHref: string;
}) {
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });
  const { user } = useUser();

  const currentPhase = instance.instanceData?.phases?.find(
    (phase) => phase.phaseId === instance.currentStateId,
  );
  const isInReviewPhase = currentPhase?.rules?.proposals?.review === true;
  const isAuthor =
    !!user.currentProfile?.id &&
    proposal.submittedBy?.id === user.currentProfile.id;
  const canSeeRevisions =
    isInReviewPhase &&
    (isAuthor ||
      instance.access?.admin === true ||
      instance.access?.review === true);

  return (
    <ProposalView
      proposal={proposal}
      canSeeRevisions={canSeeRevisions}
      backHref={backHref}
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

const ProposalViewPage = () => {
  const { profileId, slug } = useParams<{
    profileId: string;
    slug: string;
  }>();

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

export default ProposalViewPage;
