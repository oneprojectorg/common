/**
 * Instance data creation helpers for DecisionSchemaDefinition templates.
 */
import type { DecisionSchemaDefinition } from './types';

export interface PhaseInstanceData {
  phaseId: string;
  rules: {
    proposals?: { submit?: boolean; edit?: boolean };
    voting?: { submit?: boolean; edit?: boolean };
    advancement?: { method: 'date' | 'manual'; start?: string };
  };
}

/**
 * Creates instance data from a DecisionSchemaDefinition template.
 * This generates the instanceData object that will be stored in the processInstances table.
 */
export function createInstanceDataFromTemplate(input: {
  template: DecisionSchemaDefinition;
  budget?: number;
}) {
  const { template, budget } = input;

  const firstPhase = template.phases[0];
  if (!firstPhase) {
    throw new Error('Template must have at least one phase');
  }

  return {
    budget,
    currentPhaseId: firstPhase.id,
    fieldValues: {},
    config: template.config,
    phases: template.phases.map((phase) => ({
      phaseId: phase.id,
      rules: phase.rules,
    })),
  };
}
