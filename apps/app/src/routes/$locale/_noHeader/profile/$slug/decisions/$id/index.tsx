import { prefetchLegacyDecision } from '@/server/profileRoutes.functions';
import { ResourceErrorBoundary } from '@/utils/ResourceErrorBoundary';
import { parseDehydratedState } from '@op/api/dehydratedState';
import { Skeleton } from '@op/sense/Skeleton';
import { HydrationBoundary } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Suspense, useMemo } from 'react';

import { pageTitle } from '@/lib/head';
import { getTranslations } from '@/lib/i18n';

import { DecisionHeader } from '@/components/decisions/DecisionHeader';
import { DecisionStateRouter } from '@/components/decisions/DecisionStateRouter';
import { DecisionTranslationProvider } from '@/components/decisions/DecisionTranslationContext';
import { TranslationDetectionProvider } from '@/components/decisions/TranslationDetectionContext';
import { DecisionPageSkeleton } from '@/components/skeletons/DecisionSkeleton';

export const Route = createFileRoute(
  '/$locale/_noHeader/profile/$slug/decisions/$id/',
)({
  loader: async ({ params }) => {
    const [t, { dehydratedState, instance }] = await Promise.all([
      getTranslations({ locale: params.locale }),
      prefetchLegacyDecision({ data: { instanceId: params.id } }),
    ]);

    return {
      dehydratedState,
      // No title when the read failed: the page then shows the error state.
      title: instance ? instance.name || t('decisions.decisionLabel') : null,
    };
  },
  head: ({ loaderData }) => ({
    meta: loaderData?.title ? [pageTitle(loaderData.title)] : [],
  }),
  pendingComponent: DecisionPageSkeleton,
  component: DecisionInstancePage,
});

function DecisionInstancePage() {
  const { id: instanceId, slug } = Route.useParams();
  const { dehydratedState } = Route.useLoaderData();
  const hydrationState = useMemo(
    () => parseDehydratedState(dehydratedState),
    [dehydratedState],
  );

  return (
    <HydrationBoundary state={hydrationState}>
      <ResourceErrorBoundary>
        <Suspense fallback={<DecisionHeaderSkeleton />}>
          <div className="bg-muted text-gray-700">
            <DecisionTranslationProvider>
              <TranslationDetectionProvider>
                <DecisionHeader instanceId={instanceId} slug={slug} useLegacy />
                <Suspense
                  fallback={<Skeleton className="h-96" aria-hidden="true" />}
                >
                  <DecisionStateRouter
                    instanceId={instanceId}
                    slug={slug}
                    useLegacy
                  />
                </Suspense>
              </TranslationDetectionProvider>
            </DecisionTranslationProvider>
          </div>
        </Suspense>
      </ResourceErrorBoundary>
    </HydrationBoundary>
  );
}

function DecisionHeaderSkeleton() {
  return (
    <div aria-hidden="true" className="border-b bg-muted">
      {/* Header skeleton */}
      <div className="flex items-center justify-between border-b bg-white px-6 py-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>

      {/* Stepper skeleton */}
      <div className="flex flex-col overflow-x-auto sm:items-center">
        <div className="w-fit rounded-b border border-t-0 bg-white px-12 py-4 sm:px-32">
          <div className="mx-auto flex items-center justify-center space-x-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="mt-3 h-4 w-24" />
                <Skeleton className="mt-1 h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
