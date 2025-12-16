/**
 * JSON-based voting schema definition types.
 *
 * This allows voting process schemas to be defined declaratively in JSON,
 * using RJSF-compatible schema and uiSchema formats.
 */

import type { JSONSchema7 } from 'json-schema';

/**
 * RJSF-compatible UI Schema type
 * Defines how form fields should be rendered
 */
export interface UiSchema {
  [key: string]: {
    'ui:widget'?: string;
    'ui:placeholder'?: string;
    'ui:options'?: Record<string, unknown>;
    'ui:disabled'?: boolean;
    'ui:readonly'?: boolean;
    'ui:hidden'?: boolean;
    'ui:help'?: string;
    'ui:title'?: string;
    'ui:description'?: string;
    'ui:autofocus'?: boolean;
    'ui:emptyValue'?: unknown;
    [key: string]: unknown;
  } | UiSchema;
}

/**
 * JSON Schema property with optional error messages
 */
export interface SchemaProperty extends JSONSchema7 {
  errorMessage?: Record<string, string>;
}

/**
 * JSON Schema for form validation (RJSF-compatible)
 */
export interface FormSchema extends Omit<JSONSchema7, 'properties'> {
  properties?: Record<string, SchemaProperty>;
}

/**
 * Binding that maps a form field to a location in the process schema
 */
export interface FieldBinding {
  /** Dot-notation path in the process schema (e.g., 'instanceData.fieldValues.maxVotesPerMember') */
  target: string;
  /** Optional transform: 'direct' (default) or custom transform name */
  transform?: string;
}

/**
 * Complete voting schema definition with form schema, UI schema, defaults, and bindings
 */
export interface VotingSchemaDefinition {
  /** Unique identifier for this schema type */
  schemaType: string;

  /** Display name for the schema */
  name: string;

  /** Description of the voting process type */
  description?: string;

  /**
   * JSON Schema for form validation (RJSF-compatible)
   * Defines field types, validation rules, titles, descriptions
   */
  formSchema: FormSchema;

  /**
   * RJSF UI Schema for form rendering
   * Uses standard RJSF format: { fieldName: { 'ui:widget': '...', 'ui:placeholder': '...' } }
   */
  uiSchema: UiSchema;

  /**
   * Default values for form fields
   */
  defaults: Record<string, unknown>;

  /**
   * Bindings that map form fields to process schema locations
   * Key is the form field name, value describes where it goes in the process schema
   */
  bindings: Record<string, FieldBinding>;
}

/**
 * Field constraint for proposal config (kept for backward compatibility)
 */
export interface FieldConstraint {
  type: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  enum?: string[];
}

/**
 * Processed voting config extracted from form data
 */
export interface ProcessedVotingConfig {
  allowProposals: boolean;
  allowDecisions: boolean;
  maxVotesPerMember: number;
  schemaType: string;
  additionalConfig?: Record<string, unknown>;
}

/**
 * Processed proposal config
 */
export interface ProcessedProposalConfig {
  requiredFields: string[];
  optionalFields: string[];
  fieldConstraints: Record<string, FieldConstraint>;
  schemaType: string;
  allowProposals: boolean;
}

/**
 * Result of processing a schema
 */
export interface SchemaProcessResult {
  schemaType: string;
  isValid: boolean;
  errors: string[];
  votingConfig?: ProcessedVotingConfig;
  proposalConfig?: ProcessedProposalConfig;
}

// Re-export types for convenience
export type { JSONSchema7 } from 'json-schema';
