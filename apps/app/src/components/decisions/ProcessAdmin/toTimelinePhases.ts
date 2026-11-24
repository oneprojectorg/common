import type { RouterOutput } from '@op/api/client';
import type { ProcessPhase } from '@op/api/encoders';

type DecisionPhase =
  RouterOutput['decision']['getDecisionBySlug']['processInstance']['phases'][number];

/** The rail renders the public timeline's shape; this adapts the decision's phases to it. */
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
  const timelinePhases = phases.map((phase, index) => ({
    id: phase.id ?? `unstored-${index}`,
    name: phase.name ?? '',
    description: phase.description,
    phase: { startDate: phase.startDate, endDate: phase.endDate },
    advancementMethod: phase.rules?.advancement?.method,
    config: { allowProposals: phase.rules?.proposals?.submit },
  }));
  const currentIndex = phases.findIndex(
    (phase) => phase.phaseId === currentStateId,
  );

  return {
    phases: timelinePhases,
    currentPhaseId: timelinePhases[currentIndex]?.id ?? '',
  };
}
