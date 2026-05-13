'use client';

import { trpc } from '@op/api/client';
import { isLastPhase } from '@op/common/client';
import { cn } from '@op/ui/utils';
import type { ReactNode } from 'react';

/**
 * Outer wrapper around the SSR DecisionHeader content. The conditional
 * gradient depends on `selectionsAreConfirmed`, which flips when an admin
 * confirms the final-phase selection. Channel-based invalidation
 * (Channels.decisionInstance) updates the client query for all observers, so
 * deriving the className from that same query here keeps every browser's
 * header in sync without needing router.refresh().
 */
export const DecisionHeaderShell = ({
  instanceId,
  useLegacy = false,
  children,
}: {
  instanceId: string;
  /** Legacy instances always render the funded-results gradient. */
  useLegacy?: boolean;
  children: ReactNode;
}) => {
  if (useLegacy) {
    return <div className="bg-redPurple text-neutral-offWhite">{children}</div>;
  }
  return (
    <LiveDecisionHeaderShell instanceId={instanceId}>
      {children}
    </LiveDecisionHeaderShell>
  );
};

const LiveDecisionHeaderShell = ({
  instanceId,
  children,
}: {
  instanceId: string;
  children: ReactNode;
}) => {
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });
  const phases = instance.instanceData?.phases ?? [];
  const isResultsView =
    isLastPhase(instance.currentStateId, phases) &&
    instance.selectionsAreConfirmed === true;

  return (
    <div
      className={cn(
        isResultsView
          ? 'bg-redPurple text-neutral-offWhite'
          : 'bg-neutral-offWhite text-gray-700',
      )}
    >
      {children}
    </div>
  );
};
