import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import { logger } from '@op/logging';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { CurrentPhaseView } from '@/components/decisions/CurrentPhaseView';
import { DecisionContentSkeleton } from '@/components/skeletons/DecisionSkeleton';

import { loadDecision } from '../loadDecision';

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

    // Title the page with the active phase's name; fall back to a generic
    // label if it can't be resolved. Phase data rides along on the decision
    // profile, so no extra instance fetch is needed.
    const { instanceData, currentStateId } = decisionProfile.processInstance;
    const currentPhase = instanceData?.phases?.find(
      (phase) => phase.phaseId === currentStateId,
    );
    const label = currentPhase?.name || t('Current Phase');

    return {
      title: decisionProfile.name
        ? `${label} | ${decisionProfile.name}`
        : label,
    };
  } catch {
    return {};
  }
}

/**
 * Current-phase tab (/decisions/[slug]/current). The shared header + tabs come
 * from the (decision-view) layout; this only renders the phase content.
 */
const CurrentPhasePage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;
  const { decisionProfile, instanceId, ownerSlug } = await loadDecision(slug);

  // Seed the getInstance cache the current-phase content (DecisionStateRouter)
  // hydrates from. The (decision-view) layout no longer fetches getInstance
  // (the overview route is single-fetch), so /current seeds its own. Best
  // effort: on failure the client refetches under its own boundary.
  const { utils, queryClient } = await createServerUtils();
  try {
    await utils.decision.getInstance.fetch({ instanceId });
  } catch (error) {
    logger.warn('Failed to seed current-phase instance', {
      instanceId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="bg-neutral-offWhite pt-8 md:pt-0">
        <Suspense fallback={<DecisionContentSkeleton />}>
          <CurrentPhaseView
            instanceId={instanceId}
            ownerSlug={ownerSlug}
            decisionSlug={slug}
            decisionProfileId={decisionProfile.id}
            isAdmin={decisionProfile.processInstance?.access?.admin}
          />
        </Suspense>
      </div>
    </HydrationBoundary>
  );
};

export default CurrentPhasePage;
