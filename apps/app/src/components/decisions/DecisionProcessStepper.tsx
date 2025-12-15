'use client';

import { type Phase, PhaseStepper } from '@op/ui/PhaseStepper';

interface ProcessPhase {
  id: string;
  name: string;
  description?: string;
  phase?: {
    startDate?: string;
    endDate?: string;
    sortOrder?: number;
  };
  type?: 'initial' | 'intermediate' | 'final';
}

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
