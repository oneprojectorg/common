import { formatPhaseDate } from '@op/ui/utils/formatting';

export interface NextStep {
  id: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
}

interface PhaseWithDates {
  phaseId: string;
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
}

export function getNextSteps(
  phases: PhaseWithDates[],
  currentStateId: string | null,
): NextStep[] {
  // Find current phase index
  const currentPhaseIndex = phases.findIndex(
    (phase) => phase.phaseId === currentStateId,
  );

  if (currentPhaseIndex === -1) {
    return [];
  }

  // Get upcoming phases (phases after current one)
  const upcomingPhases = phases
    .slice(currentPhaseIndex + 1)
    .filter((phase) => phase.startDate) // Only include phases with dates
    .map((phase) => ({
      id: phase.phaseId,
      name: phase.name ?? '',
      description: phase.description,
      startDate: phase.startDate,
      endDate: phase.endDate,
    }));

  return upcomingPhases;
}

export function formatStepForDisplay(step: NextStep, locale: string): string {
  if (!step.startDate) {
    return step.name;
  }

  const formattedDate = formatPhaseDate(
    step.startDate,
    { month: 'short', day: 'numeric', year: 'numeric' },
    locale,
  );

  return `${step.name} on ${formattedDate}`;
}
