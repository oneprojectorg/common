import type { ProcessPhase } from '@op/api/encoders';

import type { ProcessAdminPhase } from './types';

/** The rail still renders the public timeline's shape; this adapts the manage phase to it. */
export function toTimelinePhases(phases: ProcessAdminPhase[]): {
  phases: ProcessPhase[];
  currentPhaseId: string;
} {
  const current = phases.find((phase) => phase.isCurrent);

  return {
    phases: phases.map((phase) => ({
      id: toTimelineId(phase),
      name: phase.name,
      description: phase.description,
      phase: { startDate: phase.startDate, endDate: phase.endDate },
      advancementMethod: phase.rules?.advancement?.method,
      config: { allowProposals: phase.rules?.proposals?.submit },
    })),
    currentPhaseId: current ? toTimelineId(current) : '',
  };
}

const toTimelineId = ({ id, sortOrder }: ProcessAdminPhase) =>
  id ?? `unstored-${sortOrder}`;
