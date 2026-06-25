import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { DecisionHeader } from '@/components/decisions/DecisionHeader';
import { DecisionSidePanel } from '@/components/decisions/DecisionSidePanel';
import { DecisionStateRouter } from '@/components/decisions/DecisionStateRouter';
import { DecisionTranslationProvider } from '@/components/decisions/DecisionTranslationContext';
import { PromoteAccountModal } from '@/components/decisions/PromoteAccountModal';
import { DecisionContentSkeleton } from '@/components/skeletons/DecisionSkeleton';

import { loadDecision } from './(decision-view)/loadDecision';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;

  try {
    const [{ decisionProfile }, t] = await Promise.all([
      loadDecision(slug),
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
  const { decisionProfile, instanceId, ownerSlug } = await loadDecision(slug);
  const { utils, queryClient } = await createServerUtils();

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
          <PromoteAccountModal />
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
