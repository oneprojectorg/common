import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import { createClient } from '@op/api/serverClient';
import { CommonError } from '@op/common';
import { forbidden, notFound } from 'next/navigation';
import { Suspense } from 'react';

import { DecisionHeader } from '@/components/decisions/DecisionHeader';
import { DecisionOverview } from '@/components/decisions/DecisionOverview';
import { DecisionContentSkeleton } from '@/components/skeletons/DecisionSkeleton';

const DecisionOverviewPageContent = async ({ slug }: { slug: string }) => {
  const [client, { utils, queryClient }] = await Promise.all([
    createClient(),
    createServerUtils(),
  ]);

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

  // Prefetch the instance so the client-side useSuspenseQuery in
  // DecisionHeader resolves synchronously on hydration (no skeleton flicker).
  await utils.decision.getInstance.prefetch({ instanceId });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DecisionHeader
        instanceId={instanceId}
        decisionSlug={slug}
        isAdmin={decisionProfile.processInstance.access?.admin}
        canReadUpdates={
          decisionProfile.processInstance.access?.admin === true ||
          decisionProfile.processInstance.access?.read === true
        }
        profileName={decisionProfile.name}
      >
        <Suspense fallback={<DecisionContentSkeleton />}>
          <DecisionOverview
            instanceId={instanceId}
            slug={ownerSlug}
            decisionSlug={slug}
            decisionProfileId={decisionProfile.id}
          />
        </Suspense>
      </DecisionHeader>
    </HydrationBoundary>
  );
};

const DecisionOverviewPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;

  return <DecisionOverviewPageContent slug={slug} />;
};

export default DecisionOverviewPage;
