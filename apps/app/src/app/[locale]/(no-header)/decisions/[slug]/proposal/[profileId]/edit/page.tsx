'use client';

import { trpc } from '@op/api/client';
import { notFound, useParams } from 'next/navigation';
import { Suspense } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';
import { ProposalEditorSkeleton } from '@/components/decisions/ProposalEditorSkeleton';
import { ProposalEditor } from '@/components/decisions/proposalEditor';

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
      proposal={proposal}
      isEditMode={true}
    />
  );
}

const ProposalEditPage = () => {
  const { profileId, slug } = useParams<{
    profileId: string;
    slug: string;
  }>();

  return (
    <ErrorBoundary>
      <Suspense fallback={<ProposalEditorSkeleton />}>
        <ProposalEditPageContent profileId={profileId} slug={slug} />
      </Suspense>
    </ErrorBoundary>
  );
};

export default ProposalEditPage;
