import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import { createClient } from '@op/api/serverClient';
import { CommonError } from '@op/common';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { forbidden, notFound } from 'next/navigation';
import { Suspense, cache } from 'react';

import { DecisionHeader } from '@/components/decisions/DecisionHeader';
import { DecisionSidePanel } from '@/components/decisions/DecisionSidePanel';
import { DecisionStateRouter } from '@/components/decisions/DecisionStateRouter';
import { DecisionTranslationProvider } from '@/components/decisions/DecisionTranslationContext';
import { DecisionContentSkeleton } from '@/components/skeletons/DecisionSkeleton';

// Shared per-request fetch so generateMetadata and the page render hit the
// resolver once instead of twice.
const fetchDecisionBySlug = cache(async (slug: string) => {
  const client = await createClient();
  return client.decision.getDecisionBySlug({ slug });
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;

  try {
    const [decisionProfile, t] = await Promise.all([
      fetchDecisionBySlug(slug),
      getTranslations({ locale }),
    ]);
    const name = decisionProfile?.name || t('Decision');
    const steward = decisionProfile?.processInstance?.owner?.name;

    return { title: steward ? `${name} | ${steward}` : name };
  } catch {
    return {};
  }
}

const DecisionPageContent = async ({ slug }: { slug: string }) => {
  const { utils, queryClient } = await createServerUtils();

  let decisionProfile;
  try {
    decisionProfile = await fetchDecisionBySlug(slug);
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
  // DecisionHeader and DecisionStateRouter resolves synchronously on hydration
  // (no skeleton flicker) — the two suspense reads share this cached entry.
  await utils.decision.getInstance.prefetch({ instanceId });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="bg-neutral-offWhite text-gray-700">
        <DecisionTranslationProvider>
          <DecisionHeader
            instanceId={instanceId}
            decisionSlug={slug}
            isAdmin={decisionProfile.processInstance.access?.admin}
            canReadUpdates={
              decisionProfile.processInstance.access?.admin === true ||
              decisionProfile.processInstance.access?.read === true
            }
            profileName={decisionProfile.name}
          />
          <Suspense fallback={<DecisionContentSkeleton />}>
            <DecisionStateRouter
              instanceId={instanceId}
              slug={ownerSlug}
              decisionSlug={slug}
              decisionProfileId={decisionProfile.id}
            />
          </Suspense>
          <DecisionSidePanel
            decisionProfileId={decisionProfile.id}
            access={decisionProfile.processInstance.access}
          />
        </DecisionTranslationProvider>
      </div>
    </HydrationBoundary>
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
