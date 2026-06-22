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
  // (no second fetch, no divergence) and feeds both the RSC body and the
  // pinned-resources seeding below. Best-effort: on failure the cache stays
  // empty, so the client refetches and its APIErrorBoundary drives the error UX.
  let aboutSlot: ReactNode = null;
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
    const body = instance.instanceData?.overview?.body;
    if (body) {
      aboutSlot = <RichTextRenderer content={body} />;
    }

    // Seed the pinned-resources queries (collections for the decision profile,
    // then each collection's resources) into the same cache, so the sidebar
    // hydrates from server HTML with no client waterfall. Independent
    // best-effort: a failure here leaves the body intact and the client
    // refetches those queries under its own boundary.
    const { profileId } = instance;
    if (profileId) {
      try {
        const collections = await utils.resources.collections.list.fetch({
          profileId,
        });
        await Promise.all(
          collections.items.map((collection) =>
            utils.resources.listByCollection.fetch({
              collectionId: collection.id,
            }),
          ),
        );
      } catch (error) {
        logger.warn('Failed to server-render decision pinned resources', {
          instanceId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<DecisionContentSkeleton />}>
        <DecisionOverviewSuspense
          instanceId={instanceId}
          decisionSlug={slug}
          aboutSlot={aboutSlot}
        />
      </Suspense>
    </HydrationBoundary>
  );
};

export default DecisionOverviewPage;
