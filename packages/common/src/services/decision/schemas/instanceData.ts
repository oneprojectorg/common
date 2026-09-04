/**
 * Instance data creation helpers for DecisionSchemaDefinition templates.
 */
import type { UiSchema } from '@rjsf/utils';
import type { JSONContent } from '@tiptap/core';
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

/**
 * Returns true when the current phase is the last (final/results) phase.
 * In the new schema, phase type is inferred from position: the last phase
 * in the array is the final phase.
 */
export function isLastPhase(
  currentStateId: string | null | undefined,
  phases: readonly { phaseId: string }[],
): boolean {
  if (!currentStateId || phases.length === 0) {
    return false;
  }
  return currentStateId === phases[phases.length - 1]?.phaseId;
}

/** Narrows the `instanceData` jsonb column to its phase list. */
export function getInstancePhases(
  instanceData: unknown,
): readonly PhaseInstanceData[] {
  if (
    instanceData === null ||
    typeof instanceData !== 'object' ||
    !('phases' in instanceData)
  ) {
    return [];
  }

  const { phases } = instanceData;

  return Array.isArray(phases) ? phases : [];
}

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
  /** Phase-specific rubric; resolve via `getPhaseRubricTemplate`, never directly. */
  rubricTemplate?: RubricTemplateSchema;
}

/** Public-facing overview content (headline, short description, rich text body) */
export interface InstanceOverview {
  headline?: string;
  description?: string;
  /**
   * Rich text body. New content is a TipTap JSON doc (`editor.getJSON()`),
   * which the static renderer consumes directly. Legacy rows hold an HTML
   * string (`editor.getHTML()`) until backfilled; both shapes are read.
   */
  body?: string | JSONContent;
  /**
   * Storage object path (bucket-relative) of the hero background image,
   * resolved to a URL via `getPublicUrl`. Empty/undefined falls back to the
   * gradient banner. Admins upload it from the Process Builder Overview tab.
   */
  heroImage?: string;
}

/**
 * Instance data stored in processInstances table for new DecisionSchemaDefinition-based instances.
 * This structure must match instanceDataWithSchemaEncoder in the API encoders.
 */
export interface DecisionInstanceData {
  config?: ProcessConfig;
  overview?: InstanceOverview;
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
  /** Phase rubric override; `null` clears it, `undefined` leaves it unchanged. */
  rubricTemplate?: RubricTemplateSchema | null;
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
        ...(phase.rubricTemplate && { rubricTemplate: phase.rubricTemplate }),
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
