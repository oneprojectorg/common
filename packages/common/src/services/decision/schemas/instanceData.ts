/**
 * Instance data creation helpers for DecisionSchemaDefinition templates.
 */
import type {
  DecisionSchemaDefinition,
  PhaseRules,
  ProcessConfig,
} from './types';

export interface PhaseInstanceData {
  phaseId: string;
  rules: PhaseRules;
  startDate?: string;
  endDate?: string;
}

/**
 * Instance data stored in processInstances table for new DecisionSchemaDefinition-based instances.
 * This structure must match instanceDataNewEncoder in the API encoders.
 */
export interface DecisionInstanceData {
  budget?: number;
  currentPhaseId: string;
  fieldValues: Record<string, unknown>;
  config?: ProcessConfig;
  phases: PhaseInstanceData[];
}

/**
 * Creates instance data from a DecisionSchemaDefinition template.
 * This generates the instanceData object that will be stored in the processInstances table.
 */
export function createInstanceDataFromTemplate(input: {
  template: DecisionSchemaDefinition;
  budget?: number;
  phaseOverrides?: Array<{
    phaseId: string;
    startDate?: string;
    endDate?: string;
  }>;
}): DecisionInstanceData {
  const { template, budget, phaseOverrides } = input;

  const firstPhase = template.phases[0];
  if (!firstPhase) {
    throw new Error('Template must have at least one phase');
  }

  // Create a map of phase overrides for quick lookup
  const overrideMap = new Map(
    phaseOverrides?.map((override) => [override.phaseId, override]) ?? [],
  );

  return {
    budget,
    currentPhaseId: firstPhase.id,
    fieldValues: {},
    config: template.config,
    phases: template.phases.map((phase) => {
      const override = overrideMap.get(phase.id);
      return {
        phaseId: phase.id,
        rules: phase.rules,
        ...(override?.startDate && {
          startDate: override.startDate,
        }),
        ...(override?.endDate && {
          endDate: override.endDate,
        }),
      };
    }),
  };
}
