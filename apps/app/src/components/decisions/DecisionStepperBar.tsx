import { type ProcessPhase } from '@op/api/encoders';

import { DecisionProcessStepper } from '@/components/decisions/DecisionProcessStepper';

interface DecisionStepperBarProps {
  phases: ProcessPhase[];
  currentStateId: string;
  instanceId: string;
  isAdmin?: boolean;
}

/**
 * The white phase-stepper bar that hangs below the decision header. Shared by
 * both DecisionHeader variants so the wrapper markup lives in one place.
 */
export function DecisionStepperBar({
  phases,
  currentStateId,
  instanceId,
  isAdmin,
}: DecisionStepperBarProps) {
  return (
    <div className="flex flex-col overflow-x-auto sm:items-center">
      <div className="w-fit rounded-b border border-t-0 bg-white px-12 py-4 sm:px-32">
        <DecisionProcessStepper
          phases={phases}
          currentStateId={currentStateId}
          instanceId={instanceId}
          isAdmin={isAdmin}
          className="mx-auto"
        />
      </div>
    </div>
  );
}
