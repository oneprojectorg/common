import type { InstancePhaseData } from '@op/api/encoders';

import type { ProcessAdminPhase } from './types';

/**
 * Maps the instance's stored phases to the manage shape until `listPhases`
 * serves rows. The stored slug stands in for the row uuid, so this is the one
 * place a slug reaches the manage surface; the wiring milestone deletes it.
 */
export function toProcessAdminPhases({
  phases,
  currentStateId,
}: {
  phases: InstancePhaseData[] | undefined;
  currentStateId: string | null | undefined;
}): ProcessAdminPhase[] {
  return (phases ?? []).map((phase, index) => ({
    id: phase.phaseId,
    isCurrent: phase.phaseId === currentStateId,
    sortOrder: index,
    name: phase.name ?? '',
    description: phase.description,
    startDate: phase.startDate,
    endDate: phase.endDate,
    rules: phase.rules,
    rubricTemplate: phase.rubricTemplate,
  }));
}
