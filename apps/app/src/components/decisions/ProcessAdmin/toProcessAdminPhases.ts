import type { RouterOutput } from '@op/api/client';

import type { ProcessAdminPhase } from './types';

type DecisionPhase =
  RouterOutput['decision']['getDecisionBySlug']['processInstance']['phases'][number];

export function toProcessAdminPhases({
  phases,
  currentStateId,
}: {
  phases: DecisionPhase[];
  currentStateId: string | null | undefined;
}): ProcessAdminPhase[] {
  return phases.map((phase, index) => ({
    id: phase.id,
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
