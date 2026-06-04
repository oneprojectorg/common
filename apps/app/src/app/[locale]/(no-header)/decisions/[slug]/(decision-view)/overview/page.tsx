import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { DecisionOverview } from '@/components/decisions/DecisionOverview';
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
  const { decisionProfile, instanceId, ownerSlug } = await loadDecision(slug);

  return (
    <Suspense fallback={<DecisionContentSkeleton />}>
      <DecisionOverview
        instanceId={instanceId}
        slug={ownerSlug}
        decisionSlug={slug}
        decisionProfileId={decisionProfile.id}
      />
    </Suspense>
  );
};

export default DecisionOverviewPage;
