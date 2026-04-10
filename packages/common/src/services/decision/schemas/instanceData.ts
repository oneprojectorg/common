/**
 * Instance data schemas and types for decision process instances.
 */
import type { UiSchema } from '@rjsf/utils';
import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod';

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

// ============ Zod Schemas ============

/** Zod schema for the `instanceData` JSONB column (loose — tolerates extra fields). */
export const instanceDataSchema = z.looseObject({
  currentPhaseId: z.string(),
  config: z.record(z.string(), z.unknown()).nullish(),
  fieldValues: z.record(z.string(), z.unknown()).nullish(),
  templateId: z.string().nullish(),
  templateVersion: z.string().nullish(),
  templateName: z.string().nullish(),
  templateDescription: z.string().nullish(),
  phases: z.array(z.record(z.string(), z.unknown())).nullish(),
  proposalTemplate: z.record(z.string(), z.unknown()).nullish(),
  rubricTemplate: z.record(z.string(), z.unknown()).nullish(),
  stateData: z.record(z.string(), z.unknown()).nullish(),
});

// ============ Draft Instance Data ============

/**
 * Zod schema for the `draftInstanceData` JSONB column.
 *
 * Same shape as instanceData plus instance-column fields (name, description,
 * stewardProfileId) that are extracted to their own columns on publish.
 * On publish, the entire blob is copied to `instanceData` as-is.
 */
export const draftInstanceDataSchema = instanceDataSchema.extend({
  name: z.string().nullish(),
  description: z.string().nullish(),
  stewardProfileId: z.string().nullish(),
});

// ============ Instance Data Creation ============

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
    config: template.config,
    templateId: template.id,
    templateVersion: template.version,
    templateName: template.name,
    templateDescription: template.description,
    proposalTemplate: template.proposalTemplate,
    rubricTemplate: template.rubricTemplate,
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
        headline: phase.name,
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
        ...(override?.headline && { headline: override.headline }),
      };
    }),
  };
}
