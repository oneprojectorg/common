/**
 * Instance data creation helpers for DecisionSchemaDefinition templates.
 */
import type { UiSchema } from '@rjsf/utils';
import type { JSONSchema7 } from 'json-schema';

import { CommonError, ValidationError } from '../../../utils';
import { schemaValidator } from '../schemaValidator';
import type { SelectionPipeline } from '../selectionPipeline/types';
import type { ProposalTemplateSchema, RubricTemplateSchema } from '../types';
import type {
  DecisionSchemaDefinition,
  PhaseRules,
  ProcessConfig,
} from './types';

export interface PhaseInstanceData {
  phaseId: string;
  name?: string;
  description?: string;
  headline?: string;
  additionalInfo?: string;
  rules?: PhaseRules;
  selectionPipeline?: SelectionPipeline;
  settingsSchema?: JSONSchema7 & { ui?: UiSchema };
  startDate?: string;
  endDate?: string;
  settings?: Record<string, unknown>;
}

/**
 * Instance data stored in processInstances table for new DecisionSchemaDefinition-based instances.
 * This structure must match instanceDataNewEncoder in the API encoders.
 */
export interface DecisionInstanceData {
  currentPhaseId: string;
  config?: ProcessConfig;
  fieldValues?: Record<string, unknown>;
  templateId?: string;
  templateVersion?: string;
  templateName?: string;
  templateDescription?: string;
  phases: PhaseInstanceData[];
  /** Proposal template (JSON Schema) */
  proposalTemplate?: ProposalTemplateSchema;
  /** Rubric template (JSON Schema defining evaluation criteria) */
  rubricTemplate?: RubricTemplateSchema;
}

export interface PhaseOverride {
  phaseId: string;
  name?: string;
  description?: string;
  headline?: string;
  additionalInfo?: string;
  rules?: PhaseRules;
  startDate?: string;
  endDate?: string;
  settings?: Record<string, unknown>;
}

/**
 * Creates instance data from a DecisionSchemaDefinition template.
 * This generates the instanceData object that will be stored in the processInstances table.
 */
export function createInstanceDataFromTemplate(input: {
  template: DecisionSchemaDefinition;
  phaseOverrides?: PhaseOverride[];
}): DecisionInstanceData {
  const { template, phaseOverrides } = input;

  const firstPhase = template.phases[0];
  if (!firstPhase) {
    throw new CommonError('Template must have at least one phase');
  }

  // Create a map of phase overrides for quick lookup
  const overrideMap = new Map(
    phaseOverrides?.map((override) => [override.phaseId, override]) ?? [],
  );

  return {
    currentPhaseId: firstPhase.id,
    config: template.config,
    templateId: template.id,
    templateVersion: template.version,
    templateName: template.name,
    templateDescription: template.description,
    phases: template.phases.map((phase) => {
      const override = overrideMap.get(phase.id);

      // Validate settings against phase's settings schema if provided
      if (override?.settings && phase.settings) {
        // Strip RJSF-specific 'ui' property before AJV validation
        const { ui: _ui, ...settingsSchema } = phase.settings as JSONSchema7 & {
          ui?: unknown;
        };
        const result = schemaValidator.validate(
          settingsSchema,
          override.settings,
        );
        if (!result.valid) {
          throw new ValidationError(
            `Invalid settings for phase "${phase.id}"`,
            result.errors,
          );
        }
      }

      return {
        phaseId: phase.id,
        name: phase.name,
        ...(phase.description && { description: phase.description }),
        rules: phase.rules,
        ...(phase.selectionPipeline && {
          selectionPipeline: phase.selectionPipeline,
        }),
        ...(phase.settings && { settingsSchema: phase.settings }),
        ...(override?.startDate && {
          startDate: override.startDate,
        }),
        ...(override?.endDate && {
          endDate: override.endDate,
        }),
        ...(override?.settings && {
          settings: override.settings,
        }),
      };
    }),
  };
}
