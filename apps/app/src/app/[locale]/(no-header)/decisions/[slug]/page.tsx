import { createClient } from '@op/api/serverClient';
import { CommonError } from '@op/common';
import { match } from '@op/core';
import { Skeleton } from '@op/ui/Skeleton';
import { forbidden, notFound } from 'next/navigation';
import { Suspense } from 'react';

import { DecisionHeader } from '@/components/decisions/DecisionHeader';
import { ResultsPage } from '@/components/decisions/pages/ResultsPage';
import { StandardDecisionPage } from '@/components/decisions/pages/StandardDecisionPage';
import { VotingPage } from '@/components/decisions/pages/VotingPage';
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

  const instance = decisionProfile.processInstance;
  const ownerSlug = instance.owner?.slug;

  if (!ownerSlug) {
    notFound();
  }

  return (
    <Suspense fallback={<DecisionHeaderSkeleton />}>
      <DecisionHeader
        instance={instance}
        decisionSlug={slug}
        isAdmin={instance.access?.admin}
        profileName={decisionProfile.name}
      >
        <Suspense fallback={<Skeleton className="h-96" />}>
          {match(instance.currentStateId ?? '', {
            results: () => (
              <ResultsPage
                instanceId={instance.id}
                profileSlug={ownerSlug}
                decisionSlug={slug}
                instance={instance}
              />
            ),
            voting: () => (
              <VotingPage
                instanceId={instance.id}
                slug={ownerSlug}
                decisionSlug={slug}
                instance={instance}
              />
            ),
            _: () => (
              <StandardDecisionPage
                instanceId={instance.id}
                slug={ownerSlug}
                decisionSlug={slug}
                decisionProfileId={decisionProfile.id}
                instance={instance}
              />
            ),
          })}
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
