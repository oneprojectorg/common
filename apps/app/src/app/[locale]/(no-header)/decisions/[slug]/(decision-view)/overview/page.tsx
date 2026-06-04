import { Suspense } from 'react';

import { DecisionOverview } from '@/components/decisions/DecisionOverview';
import { DecisionContentSkeleton } from '@/components/skeletons/DecisionSkeleton';

import { loadDecision } from '../loadDecision';

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
