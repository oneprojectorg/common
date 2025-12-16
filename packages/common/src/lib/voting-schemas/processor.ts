/**
 * Utilities for working with voting schema definitions.
 *
 * Note: Form validation should be handled by @rjsf/validator-ajv8 in the app layer.
 * This processor focuses on schema utilities like applying bindings and extracting configs.
 *
 * @see https://rjsf-team.github.io/react-jsonschema-form/docs/usage/validation/
 */

import type {
  VotingSchemaDefinition,
  SchemaProcessResult,
  ProcessedVotingConfig,
  ProcessedProposalConfig,
  FieldBinding,
} from './types';

/**
 * Get a value from an object using dot-notation path
 */
export function getValueByPath(obj: unknown, path: string): unknown {
  if (typeof obj !== 'object' || obj === null) {
    return undefined;
  }

  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Set a value in an object using dot-notation path
 */
export function setValueByPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  const lastPart = parts[parts.length - 1];
  if (lastPart !== undefined) {
    current[lastPart] = value;
  }
}

/**
 * Apply a single binding to transform a form value to process schema location
 */
export function applyBinding(
  result: Record<string, unknown>,
  fieldName: string,
  value: unknown,
  binding: FieldBinding,
): void {
  // Skip special transforms - those are handled by consuming code
  if (binding.transform && binding.transform !== 'direct') {
    return;
  }
  setValueByPath(result, binding.target, value);
}

/**
 * Apply all bindings to transform form data into process schema structure
 */
export function applyBindings(
  formData: Record<string, unknown>,
  schema: VotingSchemaDefinition,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [fieldName, binding] of Object.entries(schema.bindings)) {
    const value = formData[fieldName];
    if (value !== undefined) {
      applyBinding(result, fieldName, value, binding);
    }
  }

  return result;
}

/**
 * Get bindings that require special transforms (e.g., stateConfig)
 */
export function getSpecialBindings(
  schema: VotingSchemaDefinition,
): Record<string, FieldBinding> {
  return Object.fromEntries(
    Object.entries(schema.bindings).filter(
      ([, binding]) => binding.transform && binding.transform !== 'direct',
    ),
  );
}

/**
 * Merge form data with schema defaults
 */
export function mergeWithDefaults(
  formData: Record<string, unknown>,
  schema: VotingSchemaDefinition,
): Record<string, unknown> {
  return {
    ...schema.defaults,
    ...formData,
  };
}

/**
 * Extract voting config from form data
 */
export function extractVotingConfig(
  formData: Record<string, unknown>,
  schema: VotingSchemaDefinition,
): ProcessedVotingConfig {
  const merged = mergeWithDefaults(formData, schema);

  return {
    allowProposals: (merged.allowProposals as boolean) ?? true,
    allowDecisions: (merged.allowDecisions as boolean) ?? true,
    maxVotesPerMember: (merged.maxVotesPerMember as number) ?? 3,
    schemaType: schema.schemaType,
    additionalConfig: Object.fromEntries(
      Object.entries(merged).filter(
        ([key]) =>
          !['allowProposals', 'allowDecisions', 'maxVotesPerMember'].includes(
            key,
          ),
      ),
    ),
  };
}

/**
 * Extract proposal config from schema
 */
export function extractProposalConfig(
  formData: Record<string, unknown>,
  schema: VotingSchemaDefinition,
): ProcessedProposalConfig {
  const merged = mergeWithDefaults(formData, schema);

  return {
    requiredFields: ['title', 'description'],
    optionalFields: ['amount', 'category', 'schemaSpecificData'],
    fieldConstraints: {
      title: { type: 'string', minLength: 1, maxLength: 200 },
      description: { type: 'string', minLength: 1, maxLength: 5000 },
      amount: { type: 'number', min: 0 },
      category: { type: 'string' },
    },
    schemaType: schema.schemaType,
    allowProposals: (merged.allowProposals as boolean) ?? true,
  };
}

/**
 * Process form data using a voting schema definition.
 * Note: This assumes form data has already been validated by RJSF.
 */
export function processWithSchema(
  formData: Record<string, unknown>,
  schema: VotingSchemaDefinition,
): SchemaProcessResult {
  return {
    schemaType: schema.schemaType,
    isValid: true,
    errors: [],
    votingConfig: extractVotingConfig(formData, schema),
    proposalConfig: extractProposalConfig(formData, schema),
  };
}

/**
 * Check if data has a matching schemaType
 */
export function matchesSchemaType(
  data: unknown,
  schema: VotingSchemaDefinition,
): boolean {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const dataSchemaType = (data as Record<string, unknown>).schemaType;
  return dataSchemaType === schema.schemaType;
}
