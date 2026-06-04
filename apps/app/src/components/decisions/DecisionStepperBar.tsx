'use client';

import { trpc } from '@op/api/client';
import { type ProcessPhase } from '@op/api/encoders';

import { DecisionProcessStepper } from '@/components/decisions/DecisionProcessStepper';

interface DecisionStepperBarProps {
  instanceId: string;
  isAdmin?: boolean;
}

/**
 * The phase stepper bar shown above the current-phase view. Extracted from
 * DecisionHeader so it can live in page content rather than the shared
 * header: the overview tab has no stepper, the current-phase tab does.
 */
export function DecisionStepperBar({
  instanceId,
  isAdmin,
}: DecisionStepperBarProps) {
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });

  const instancePhases = instance.instanceData?.phases ?? [];

  const phases: ProcessPhase[] = instancePhases.map((p) => ({
    id: p.phaseId,
    name: p.name || '',
    description: p.description,
    phase: {
      startDate: p.startDate,
      endDate: p.endDate,
    },
    advancementMethod: p.rules?.advancement?.method,
  }));

  return (
    <div className="flex flex-col overflow-x-auto sm:items-center">
      <div className="w-fit rounded-b border border-t-0 bg-white px-12 py-4 sm:px-32">
        <DecisionProcessStepper
          phases={phases}
          currentStateId={instance.currentStateId || ''}
          instanceId={instanceId}
          isAdmin={isAdmin}
          className="mx-auto"
        />
      </div>
    </div>
  );
}
