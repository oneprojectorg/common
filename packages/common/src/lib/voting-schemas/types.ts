/**
 * Voting schema definition types.
 * Designed to work directly with RJSF.
 */

import type { JSONSchema7 } from 'json-schema';

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
  formSchema: JSONSchema7;
  uiSchema: UiSchema;
  defaults: Record<string, unknown>;
}
