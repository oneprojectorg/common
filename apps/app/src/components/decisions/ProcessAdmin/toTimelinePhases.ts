import type { DecisionPhase, ProcessPhase } from '@op/api/encoders';

import { toProcessPhase } from '../toProcessPhases';

export function toTimelinePhases({
  phases,
  currentStateId,
}: {
  phases: DecisionPhase[];
  currentStateId: string | null | undefined;
}): {
  phases: ProcessPhase[];
  currentPhaseId: string;
} {
  const timelinePhases = phases.map((phase, index) =>
    toProcessPhase(phase, phase.id ?? `unstored-${index}`),
  );
  const currentIndex = phases.findIndex(
    (phase) => phase.phaseId === currentStateId,
  );

  return {
    phases: timelinePhases,
    currentPhaseId: timelinePhases[currentIndex]?.id ?? '',
  };
}
