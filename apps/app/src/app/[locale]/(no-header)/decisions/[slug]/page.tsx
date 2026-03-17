import { createClient } from '@op/api/serverClient';
import { logger } from '@op/logging';
import { Skeleton } from '@op/ui/Skeleton';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { DecisionHeader } from '@/components/decisions/DecisionHeader';
import { DecisionStateRouter } from '@/components/decisions/DecisionStateRouter';
import { DecisionHeaderSkeleton } from '@/components/skeletons/DecisionSkeleton';

const DecisionPageContent = async ({ slug }: { slug: string }) => {
  let client;
  try {
    client = await createClient();
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[DecisionPage] Failed to create tRPC client', { slug, error: errMsg });
    logger.error('[DecisionPage] Failed to create tRPC client', { slug, error: errMsg });
    throw err;
  }

  let decisionProfile;
  try {
    decisionProfile = await client.decision.getDecisionBySlug({
      slug,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errDetails = {
      slug,
      error: errMsg,
      errorName: err instanceof Error ? err.name : undefined,
    };
    console.error('[DecisionPage] getDecisionBySlug failed', errDetails);
    logger.error('[DecisionPage] getDecisionBySlug failed', {
      ...errDetails,
      stack: err instanceof Error ? err.stack : undefined,
    });
    throw err;
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
