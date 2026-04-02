import { createClient } from '@op/api/serverClient';
import { CommonError } from '@op/common/client';
import { Skeleton } from '@op/ui/Skeleton';
import { forbidden, notFound } from 'next/navigation';
import { Suspense } from 'react';

import { DecisionHeader } from '@/components/decisions/DecisionHeader';
import { DecisionStateRouter } from '@/components/decisions/DecisionStateRouter';
import { DecisionHeaderSkeleton } from '@/components/skeletons/DecisionSkeleton';

const DecisionPageContent = async ({ slug }: { slug: string }) => {
  const client = await createClient();

  let decisionProfile;
  try {
    decisionProfile = await client.decision.getDecisionBySlug({
      slug,
    });
  } catch (error) {
    const cause = error instanceof Error ? error.cause : null;
    if (cause instanceof CommonError && cause.statusCode === 403) {
      forbidden();
    }
    if (cause instanceof CommonError && cause.statusCode === 404) {
      notFound();
    }
    throw error;
  }

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
      <DecisionHeader
        instanceId={instanceId}
        decisionSlug={slug}
        isAdmin={decisionProfile.processInstance.access?.admin}
        profileName={decisionProfile.name}
      >
        <Suspense fallback={<Skeleton className="h-96" />}>
          <DecisionStateRouter
            instanceId={instanceId}
            slug={ownerSlug}
            decisionSlug={slug}
            decisionProfileId={decisionProfile.id}
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
