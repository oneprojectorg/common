import { DecisionStateRouter } from '@/components/decisions/DecisionStateRouter';

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
}: CurrentPhaseViewProps) {
  return (
    <DecisionStateRouter
      instanceId={instanceId}
      slug={ownerSlug}
      decisionSlug={decisionSlug}
      decisionProfileId={decisionProfileId}
    />
  );
}
