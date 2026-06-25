import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import { logger } from '@op/logging';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Suspense } from 'react';

import { DecisionOverviewSuspense } from '@/components/decisions/DecisionOverview';
import { RichTextRenderer } from '@/components/decisions/RichTextRenderer';
import { hasFirstPhaseStarted } from '@/components/decisions/hasFirstPhaseStarted';
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
    const label = t('Overview');
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
 * Overview tab (/decisions/[slug]/overview). The shared header + tabs come
 * from the (decision-view) layout; this only renders the overview content.
 *
 * Temporary home: while the overview ships behind a flag, the old
 * current-phase page stays canonical at /decisions/[slug]. When the overview
 * is ready it moves to the root and the old page is retired.
 */
const DecisionOverviewPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;
  const { instanceId } = await loadDecision(slug);
  const { utils, queryClient } = await createServerUtils();

  // One server fetch seeds the cache the client useSuspenseQuery hydrates from
  // (no second fetch, no divergence) and feeds the RSC body. Best-effort: on
  // failure the cache stays empty, so the client refetches and its
  // APIErrorBoundary drives the error UX.
  let aboutSlot: ReactNode = null;
  // The process is "active" once its first phase begins; default to active so a
  // failed fetch keeps the CTAs visible (the client suspense read drives the
  // error UX). Same gate as the view toggle in the layout.
  let isActive = true;
  const instance = await utils.decision.getInstance
    .fetch({ instanceId })
    .catch((error) => {
      logger.warn('Failed to server-render decision overview', {
        instanceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    });

  if (instance) {
    isActive = hasFirstPhaseStarted(instance.instanceData?.phases);
    const body = instance.instanceData?.overview?.body;
    if (body) {
      aboutSlot = <RichTextRenderer content={body} />;
    }
  }

  // Pinned-resources queries (collections + each collection's resources) are
  // NOT seeded here on purpose: they're secondary sidebar content with their
  // own Suspense + skeleton + error boundary (OverviewPinnedResourcesSuspense),
  // so the client fetches them after first paint instead of blocking the shell.
  // Measured ~335ms of time-to-content removed by not seeding here (2026-06-25).

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<DecisionContentSkeleton />}>
        <DecisionOverviewSuspense
          instanceId={instanceId}
          decisionSlug={slug}
          aboutSlot={aboutSlot}
          isActive={isActive}
        />
      </Suspense>
    </HydrationBoundary>
  );
};

export default DecisionOverviewPage;
