'use client';

import { type ProcessPhase } from '@op/api/encoders';
import { type Phase, PhaseStepper } from '@op/ui/PhaseStepper';

interface DecisionProcessStepperProps {
  phases: ProcessPhase[];
  currentStateId: string;
  className?: string;
}

export function DecisionProcessStepper({
  phases,
  currentStateId,
  className = '',
}: DecisionProcessStepperProps) {
  // Transform ProcessPhase to Phase format for PhaseStepper
  const transformedPhases: Phase[] = phases.map((phase) => ({
    id: phase.id,
    name: phase.name,
    description: phase.description,
    startDate: phase.phase?.startDate,
    endDate: phase.phase?.endDate,
    sortOrder: phase.phase?.sortOrder,
  }));

  return (
    <PhaseStepper
      phases={transformedPhases}
      currentPhaseId={currentStateId}
      className={className}
    />
  );
}
