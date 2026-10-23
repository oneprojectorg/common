import type { InstancePhaseData, ProcessPhase } from '@op/api/encoders';

/** Maps the instance's stored phases to the shape the phase timeline renders. */
export function toProcessPhases(
  phases: InstancePhaseData[] | undefined,
): ProcessPhase[] {
  return (phases ?? []).map((phase) => ({
    id: phase.phaseId,
    name: phase.name || '',
    description: phase.description,
    phase: { startDate: phase.startDate, endDate: phase.endDate },
    advancementMethod: phase.rules?.advancement?.method,
    config: { allowProposals: phase.rules?.proposals?.submit },
  }));
}
