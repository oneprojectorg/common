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
 * Phase behavior configuration
 */
export interface PhaseConfig {
  allowProposals?: boolean;
  allowDecisions?: boolean;
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

  /** Phase behavior configuration */
  config: PhaseConfig;

  /** Filter/reduce pipeline for advancing proposals to next phase */
  selectionPipeline?: SelectionPipeline;

  /** Optional per-phase configuration form */
  configSchema?: JSONSchema7;
  configUiSchema?: UiSchema;
  configDefaults?: Record<string, unknown>;
}

/**
 * A voting schema definition - defines the phases of a decision process.
 */
export interface VotingSchemaDefinition {
  schemaType: string;
  name: string;
  description?: string;

  /** Phase definitions */
  phases: PhaseDefinition[];
}
