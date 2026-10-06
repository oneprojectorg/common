import { prefetchCurrentPhase } from '@/server/decisions.functions';
import { parseDehydratedState } from '@op/api/dehydratedState';
import { HydrationBoundary } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Suspense, useMemo } from 'react';

import { decisionOgImageMeta } from '@/lib/decisionOgImage';
import { parseDecisionView, useDecisionView } from '@/lib/decisionView';
import { pageTitle } from '@/lib/head';
import { getTranslations } from '@/lib/i18n';

import { DecisionStateRouter } from '@/components/decisions/DecisionStateRouter';
import { DecisionContentSkeleton } from '@/components/skeletons/DecisionSkeleton';

/**
 * Current-phase tab (/decisions/$slug/current). The shared header + tabs come
 * from the _decisionView layout; this only renders the phase content.
 */
export const Route = createFileRoute(
  '/$locale/_noHeader/decisions/$slug/_decisionView/current/',
)({
  loader: async ({ params, parentMatchPromise }) => {
    const [{ loaderData }, t] = await Promise.all([
      parentMatchPromise,
      getTranslations({ locale: params.locale }),
    ]);

    if (!loaderData) {
      return null;
    }

    const { decisionProfile, instanceId } = parseDecisionView(loaderData);
    const dehydratedState = await prefetchCurrentPhase({
      data: { instanceId },
    });

    // Title the page with the active phase's name; fall back to a generic
    // label if it can't be resolved. Phase data rides along on the decision
    // profile, so no extra instance fetch is needed.
    const { instanceData, currentStateId } = decisionProfile.processInstance;
    const currentPhase = instanceData?.phases?.find(
      (phase) => phase.phaseId === currentStateId,
    );
    const label = currentPhase?.name || t('decisions.currentPhaseLabel');
    const name = decisionProfile.name;

    return {
      dehydratedState,
      title: name ? `${label} | ${name}` : label,
      ogTitle: name || label,
    };
  },
  // This phase tab stays noindex (the root's default) — the canonical decision
  // page is the indexed URL.
  head: ({ loaderData, params }) =>
    loaderData
      ? {
          meta: [
            pageTitle(loaderData.title),
            { property: 'og:title', content: loaderData.ogTitle },
            { property: 'og:type', content: 'article' },
            ...decisionOgImageMeta(
              `/${params.locale}/decisions/${params.slug}/current`,
            ),
          ],
        }
      : {},
  // Matches the hero + action bar + proposal list DecisionStateRouter renders;
  // same skeleton the page's own Suspense fallback uses.
  pendingComponent: DecisionContentSkeleton,
  component: CurrentPhasePage,
});

function CurrentPhasePage() {
  const { slug } = Route.useParams();
  const { decisionProfile, instanceId, ownerSlug } = useDecisionView();
  const dehydratedState = Route.useLoaderData()?.dehydratedState;
  const hydrationState = useMemo(
    () => (dehydratedState ? parseDehydratedState(dehydratedState) : undefined),
    [dehydratedState],
  );

  return (
    <HydrationBoundary state={hydrationState}>
      <Suspense fallback={<DecisionContentSkeleton />}>
        <DecisionStateRouter
          instanceId={instanceId}
          slug={ownerSlug}
          decisionSlug={slug}
          decisionProfileId={decisionProfile.id}
        />
      </Suspense>
    </HydrationBoundary>
  );
}
