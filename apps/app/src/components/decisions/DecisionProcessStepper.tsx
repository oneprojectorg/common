'use client';

import { type ProcessPhase } from '@op/api/encoders';
import { type Phase, PhaseStepper } from '@op/ui/PhaseStepper';
import { useMemo } from 'react';

import { useDecisionTranslation } from './DecisionTranslationContext';

export function DecisionProcessStepper({
  phases,
  currentStateId,
  className = '',
  interactivePhaseIds,
  onTransition,
}: {
  phases: ProcessPhase[];
  currentStateId: string;
  className?: string;
  interactivePhaseIds?: Set<string>;
  onTransition?: (phaseId: string) => void;
}) {
  const translation = useDecisionTranslation();
  const translatedPhaseNames = useMemo(
    () =>
      translation
        ? new Map(translation.phases.map((p) => [p.id, p.name]))
        : null,
    [translation],
  );

  // Transform ProcessPhase to Phase format for PhaseStepper
  const transformedPhases: Phase[] = phases.map((phase) => ({
    id: phase.id,
    name: translatedPhaseNames?.get(phase.id) ?? phase.name,
    description: phase.description,
    startDate: phase.phase?.startDate,
    endDate: phase.phase?.endDate,
    sortOrder: phase.phase?.sortOrder,
    interactive: interactivePhaseIds?.has(phase.id),
  }));

  return (
    <PhaseStepper
      phases={transformedPhases}
      currentPhaseId={currentStateId}
      className={className}
      onTransition={onTransition}
    />
  );
}
