'use client';

import { DecisionStateRouter } from '@/components/decisions/DecisionStateRouter';
import { DecisionStepperBar } from '@/components/decisions/DecisionStepperBar';

interface CurrentPhaseViewProps {
  instanceId: string;
  ownerSlug: string;
  decisionSlug: string;
  decisionProfileId: string;
  isAdmin?: boolean;
}

/**
 * The current-phase tab: the phase stepper followed by the phase-specific
 * view chosen by DecisionStateRouter. Rendered at /decisions/[slug]/current,
 * and at the root when the overview feature flag is off.
 */
export function CurrentPhaseView({
  instanceId,
  ownerSlug,
  decisionSlug,
  decisionProfileId,
  isAdmin,
}: CurrentPhaseViewProps) {
  return (
    <>
      <DecisionStepperBar instanceId={instanceId} isAdmin={isAdmin} />
      <DecisionStateRouter
        instanceId={instanceId}
        slug={ownerSlug}
        decisionSlug={decisionSlug}
        decisionProfileId={decisionProfileId}
      />
    </>
  );
}
