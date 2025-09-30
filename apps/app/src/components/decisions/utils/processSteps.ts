import type { InstanceData, StateDefinition } from '@op/common';

export interface NextStep {
  id: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
}

export function getNextSteps(
  states: StateDefinition[],
  instanceData: InstanceData,
): NextStep[] {
  const currentStateId = instanceData.currentStateId;

  // Find current state index
  const currentStateIndex = states.findIndex(
    (state) => state.id === currentStateId,
  );

  if (currentStateIndex === -1) {
    return [];
  }

  // Get upcoming states (states after current one)
  const upcomingStates = states
    .slice(currentStateIndex + 1)
    .filter((state) => state.phase?.startDate) // Only include states with dates
    .map((state) => ({
      id: state.id,
      name: state.name,
      description: state.description,
      startDate: state.phase?.startDate,
      endDate: state.phase?.endDate,
    }));

  return upcomingStates;
}

export function formatStepForDisplay(step: NextStep): string {
  if (!step.startDate) {
    return step.name;
  }

  const date = new Date(step.startDate);
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return `${step.name} on ${formattedDate}`;
}
