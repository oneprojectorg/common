import { Suspense } from 'react';

import { CurrentPhaseView } from '@/components/decisions/CurrentPhaseView';
import { DecisionContentSkeleton } from '@/components/skeletons/DecisionSkeleton';

import { loadDecision } from '../loadDecision';

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

  return (
    <Suspense fallback={<DecisionContentSkeleton />}>
      <CurrentPhaseView
        instanceId={instanceId}
        ownerSlug={ownerSlug}
        decisionSlug={slug}
        decisionProfileId={decisionProfile.id}
        isAdmin={decisionProfile.processInstance?.access?.admin}
      />
    </Suspense>
  );
};

export default CurrentPhasePage;
