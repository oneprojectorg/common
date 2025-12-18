/**
 * Instance data creation helpers for DecisionSchemaDefinition templates.
 */
import type { DecisionSchemaDefinition } from './types';

export interface PhaseSchedule {
  phaseId: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
}

export interface CreateInstanceDataInput {
  template: DecisionSchemaDefinition;
  budget?: number;
  phases?: PhaseSchedule[];
}

/**
 * Creates instance data from a DecisionSchemaDefinition template.
 * This generates the instanceData object that will be stored in the processInstances table.
 */
export function createInstanceDataFromTemplate(input: CreateInstanceDataInput) {
  const { template, budget, phases } = input;

  const firstPhase = template.phases[0];
  if (!firstPhase) {
    throw new Error('Template must have at least one phase');
  }

  return {
    budget,
    hideBudget: template.config?.hideBudget ?? false,
    currentPhaseId: firstPhase.id,
    fieldValues: {},
    phases: template.phases.map((phase, index) => ({
      phaseId: phase.id,
      plannedStartDate: phases?.[index]?.plannedStartDate,
      plannedEndDate: phases?.[index]?.plannedEndDate,
    })),
  };
}
