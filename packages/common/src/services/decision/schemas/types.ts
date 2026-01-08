/**
 * Decision schema definition types.
 * Designed to work directly with RJSF.
 */
import type { UiSchema } from '@rjsf/utils';
import type { JSONSchema7 } from 'json-schema';

import type { SelectionPipeline } from '../selectionPipeline/types';

/**
 * Phase behavior rules
 */
export interface PhaseRules {
  proposals?: {
    submit?: boolean;
    edit?: boolean;
  };
  voting?: {
    submit?: boolean;
    edit?: boolean;
  };
  advancement?: {
    method: 'date' | 'manual';
    endDate?: string;
  };
}

/**
 * A phase definition within a decision schema.
 * Each phase is a self-contained unit with its own config and optional selection pipeline.
 *
 * Phase type is inferred from position: first = initial, last = final, others = intermediate.
 */
export interface PhaseDefinition {
  id: string;
  name: string;
  description?: string;

  /** Phase behavior rules */
  rules: PhaseRules;

  /** Filter/reduce pipeline for advancing proposals to next phase */
  selectionPipeline?: SelectionPipeline;

  /** Optional per-phase settings form (use `default` in schema properties) */
  settings?: JSONSchema7 & { ui?: UiSchema };
}

/**
 * Process-level configuration that applies across all phases.
 */
export interface ProcessConfig {
  hideBudget?: boolean;
}

/**
 * A decision schema definition - defines the phases of a decision process.
 */
export interface DecisionSchemaDefinition {
  id: string;
  /** Semantic version (e.g., "1.0.0") */
  version: string;
  name: string;
  description?: string;

  /** Process-level configuration */
  config?: ProcessConfig;

  /** Phase definitions */
  phases: [PhaseDefinition, ...PhaseDefinition[]];
}
