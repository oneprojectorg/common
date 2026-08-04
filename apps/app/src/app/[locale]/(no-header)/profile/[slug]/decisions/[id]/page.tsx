import { ResourceErrorBoundary } from '@/utils/ResourceErrorBoundary';
import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import { Skeleton } from '@op/sense/Skeleton';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense, cache } from 'react';

import { TranslatedText } from '@/components/TranslatedText';
import { DecisionHeader } from '@/components/decisions/DecisionHeader';
import { DecisionStateRouter } from '@/components/decisions/DecisionStateRouter';
import { DecisionTranslationProvider } from '@/components/decisions/DecisionTranslationContext';

// cache() dedupes the read across generateMetadata + page render (one request),
// so the resolver and its "viewed" event fire once and the data hydrates.
const fetchLegacyInstance = cache(async (instanceId: string) => {
  const { utils } = await createServerUtils();
  return utils.decision.getLegacyInstance.fetch({ instanceId });
});

function DecisionHeaderSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="border-b bg-neutral-offWhite"
    >
      <span className="sr-only">
        <TranslatedText text="Loading..." />
      </span>
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; slug: string; locale: string }>;
}): Promise<Metadata> {
  const { id, locale } = await params;

  try {
    const [t, instance] = await Promise.all([
      getTranslations({ locale }),
      fetchLegacyInstance(id),
    ]);
    return { title: instance?.name || t('Decision') };
  } catch {
    return {};
  }
}

const DecisionInstancePageContent = async ({
  instanceId,
  slug,
}: {
  instanceId: string;
  slug: string;
}) => {
  const { queryClient } = await createServerUtils();
  // Swallow failures: this only warms the cache — the client suspense query
  // refetches and its error boundary owns errors, so a failed warmup must not
  // crash the route.
  await fetchLegacyInstance(instanceId).catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ResourceErrorBoundary>
        <Suspense fallback={<DecisionHeaderSkeleton />}>
          <div className="bg-neutral-offWhite text-gray-700">
            <DecisionTranslationProvider>
              <DecisionHeader instanceId={instanceId} slug={slug} useLegacy />
              <Suspense
                fallback={
                  <Skeleton className="h-96" role="status" aria-busy="true">
                    <span className="sr-only">
                      <TranslatedText text="Loading..." />
                    </span>
                  </Skeleton>
                }
              >
                <DecisionStateRouter
                  instanceId={instanceId}
                  slug={slug}
                  useLegacy
                />
              </Suspense>
            </DecisionTranslationProvider>
          </div>
        </Suspense>
      </ResourceErrorBoundary>
    </HydrationBoundary>
  );
};

const DecisionInstancePage = async ({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) => {
  const { id, slug } = await params;

  return <DecisionInstancePageContent instanceId={id} slug={slug} />;
};

export default DecisionInstancePage;
