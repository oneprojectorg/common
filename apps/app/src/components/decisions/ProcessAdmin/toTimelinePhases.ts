import type { ProcessPhase } from '@op/api/encoders';

import type { ProcessAdminPhase } from './types';

/** The rail still renders the public timeline's shape; this adapts the manage phase to it. */
export function toTimelinePhases(phases: ProcessAdminPhase[]): {
  phases: ProcessPhase[];
  currentPhaseId: string;
} {
  return {
    phases: phases.map((phase) => ({
      id: phase.id,
      name: phase.name,
      description: phase.description,
      phase: { startDate: phase.startDate, endDate: phase.endDate },
      advancementMethod: phase.rules?.advancement?.method,
      config: { allowProposals: phase.rules?.proposals?.submit },
    })),
    currentPhaseId: phases.find((phase) => phase.isCurrent)?.id ?? '',
  };
}
