/**
 * Instance data creation helpers for DecisionSchemaDefinition templates.
 */
import type { JSONSchema7 } from 'json-schema';

import type {
  DecisionSchemaDefinition,
  PhaseRules,
  ProcessConfig,
} from './types';

export interface PhaseInstanceData {
  phaseId: string;
  rules: PhaseRules;
  plannedStartDate?: string;
  plannedEndDate?: string;
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
 * Extracts default values from a JSON Schema's properties.
 * Returns an object with property names as keys and their default values.
 */
function extractDefaultsFromSchema(
  schema: JSONSchema7 | undefined,
): Record<string, unknown> {
  if (!schema || schema.type !== 'object' || !schema.properties) {
    return {};
  }

  const defaults: Record<string, unknown> = {};

  for (const [key, propSchema] of Object.entries(schema.properties)) {
    // In JSON Schema 7, a property can be a boolean (true = any value allowed,
    // false = no value allowed) instead of a schema object. Booleans don't have
    // defaults, so skip them.
    if (typeof propSchema === 'boolean') {
      continue;
    }
    if (propSchema.default !== undefined) {
      defaults[key] = propSchema.default;
    }
  }

  return defaults;
}

/**
 * Creates instance data from a DecisionSchemaDefinition template.
 * This generates the instanceData object that will be stored in the processInstances table.
 *
 * Field values are populated with defaults from phase settings schemas.
 * User-provided fieldValues override the defaults.
 */
export function createInstanceDataFromTemplate(input: {
  template: DecisionSchemaDefinition;
  budget?: number;
  fieldValues?: Record<string, unknown>;
  phaseOverrides?: Array<{
    phaseId: string;
    plannedStartDate?: string;
    plannedEndDate?: string;
  }>;
}): DecisionInstanceData {
  const { template, budget, fieldValues, phaseOverrides } = input;

  const firstPhase = template.phases[0];
  if (!firstPhase) {
    throw new Error('Template must have at least one phase');
  }

  // Create a map of phase overrides for quick lookup
  const overrideMap = new Map(
    phaseOverrides?.map((override) => [override.phaseId, override]) ?? [],
  );

  // Extract default values from all phase settings
  const defaultFieldValues: Record<string, unknown> = {};
  for (const phase of template.phases) {
    if (phase.settings) {
      const phaseDefaults = extractDefaultsFromSchema(phase.settings);
      Object.assign(defaultFieldValues, phaseDefaults);
    }
  }

  return {
    budget,
    currentPhaseId: firstPhase.id,
    // Merge defaults with user-provided values (user values take precedence)
    fieldValues: { ...defaultFieldValues, ...fieldValues },
    config: template.config,
    phases: template.phases.map((phase) => {
      const override = overrideMap.get(phase.id);
      return {
        phaseId: phase.id,
        rules: phase.rules,
        ...(override?.plannedStartDate && {
          plannedStartDate: override.plannedStartDate,
        }),
        ...(override?.plannedEndDate && {
          plannedEndDate: override.plannedEndDate,
        }),
      };
    }),
  };
}
