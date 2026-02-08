import { createClient } from '@op/api/serverClient';
import { Skeleton } from '@op/ui/Skeleton';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { DecisionHeader } from '@/components/decisions/DecisionHeader';
import { DecisionStateRouter } from '@/components/decisions/DecisionStateRouter';
import { DecisionHeaderSkeleton } from '@/components/skeletons/DecisionSkeleton';

const DecisionPageContent = async ({ slug }: { slug: string }) => {
  const client = await createClient();

  const decisionProfile = await client.decision.getDecisionBySlug({
    slug,
  });

  if (!decisionProfile || !decisionProfile.processInstance) {
    notFound();
  }

  const instanceId = decisionProfile.processInstance.id;
  const ownerSlug = decisionProfile.processInstance.owner?.slug;

  if (!ownerSlug) {
    notFound();
  }

  return (
    <Suspense fallback={<DecisionHeaderSkeleton />}>
      <DecisionHeader instanceId={instanceId} slug={ownerSlug} decisionSlug={slug} decisionProfileId={decisionProfile.id}>
        <Suspense fallback={<Skeleton className="h-96" />}>
          <DecisionStateRouter
            instanceId={instanceId}
            slug={ownerSlug}
            decisionSlug={slug}
          />
        </Suspense>
      </DecisionHeader>
    </Suspense>
  );
};

const DecisionPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;

  return <DecisionPageContent slug={slug} />;
};

export default DecisionPage;
