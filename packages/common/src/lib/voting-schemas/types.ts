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
 * A voting schema definition - everything needed to render a form with RJSF
 */
export interface VotingSchemaDefinition {
  schemaType: string;
  name: string;
  description?: string;
  process: JSONSchema7;
  uiSchema: UiSchema;
  defaults: Record<string, unknown>;

  /** Default selection pipeline for phase transitions */
  selectionPipeline?: SelectionPipeline;
}
