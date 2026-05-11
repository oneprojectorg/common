'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { notFound, useParams } from 'next/navigation';
import { Suspense } from 'react';

import { ProposalView } from '@/components/decisions/ProposalView';
import { ProposalViewSkeleton } from '@/components/skeletons/ProposalSkeleton';

export default function ProposalViewPage() {
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
      <Suspense fallback={<ProposalViewSkeleton />}>
        <ProposalViewPageContent profileId={profileId} slug={slug} />
      </Suspense>
    </APIErrorBoundary>
  );
}

function ProposalViewPageContent({
  profileId,
  slug,
}: {
  profileId: string;
  slug: string;
}) {
  // Warm the comments cache in parallel with the main page queries so
  // ProposalComments's suspense query resolves without an extra waterfall.
  trpc.posts.getPosts.usePrefetchQuery({
    profileId,
    parentPostId: null,
    limit: 50,
    offset: 0,
    includeChildren: false,
  });

  const [[proposal, decisionProfile]] = trpc.useSuspenseQueries((t) => [
    t.decision.getProposal({ profileId }),
    t.decision.getDecisionBySlug({ slug }),
  ]);

  if (!proposal) {
    notFound();
  }

  const instance = decisionProfile.processInstance;
  const { user } = useUser();

  const currentPhase = instance.instanceData?.phases?.find(
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

  return (
    <ProposalView
      proposal={proposal}
      canSeeRevisions={canSeeRevisions}
      backHref={`/decisions/${slug}`}
    />
  );
}
