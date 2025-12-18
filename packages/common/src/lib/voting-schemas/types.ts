/**
 * Voting schema definition types.
 * Designed to work directly with RJSF.
 */
import type { JSONSchema7 } from 'json-schema';

import type { SelectionPipeline } from '../../services/decision/selectionPipeline/types';

/**
 * RJSF UI Schema
 */
export type UiSchema = Record<string, unknown>;

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
}

/**
 * A phase definition within a voting schema.
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
 * A voting schema definition - defines the phases of a decision process.
 */
export interface VotingSchemaDefinition {
  id: string;
  /** Semantic version (e.g., "1.0.0") */
  version: string;
  name: string;
  description?: string;

  /** Process-level configuration */
  config?: ProcessConfig;

  /** Phase definitions */
  phases: PhaseDefinition[];
}
