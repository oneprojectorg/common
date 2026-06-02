'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { isLastPhase } from '@op/common/client';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { ProposalView } from '@/components/decisions/ProposalView';
import { ProposalViewSkeleton } from '@/components/decisions/ProposalViewSkeleton';

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
      <Suspense fallback={<ProposalViewSkeleton />}>
        <ProposalViewPageContent profileId={profileId} slug={slug} />
      </Suspense>
    </APIErrorBoundary>
  );
};
