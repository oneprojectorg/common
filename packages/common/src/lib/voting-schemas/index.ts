/**
 * JSON-based voting schema system using RJSF-compatible format.
 *
 * Each schema defines:
 * - formSchema: JSON Schema for validation (RJSF-compatible)
 * - uiSchema: RJSF UI schema for rendering
 * - defaults: Default form values
 * - bindings: Maps form fields to process schema locations
 *
 * Example usage:
 *
 * ```tsx
 * import { simpleSchema, votingSchemaRegistry } from './voting-schemas';
 * import Form from '@rjsf/core';
 *
 * // Use with RJSF
 * <Form
 *   schema={simpleSchema.formSchema}
 *   uiSchema={simpleSchema.uiSchema}
 *   formData={simpleSchema.defaults}
 * />
 *
 * // Get all available schemas
 * const schemas = votingSchemaRegistry.getAllSchemas();
 *
 * // Register a custom schema
 * registerVotingSchema({
 *   schemaType: 'quadratic',
 *   name: 'Quadratic Voting',
 *   formSchema: { ... },
 *   uiSchema: { ... },
 *   defaults: { ... },
 *   bindings: { ... },
 * });
 * ```
 */

export * from './types';
export * from './processor';
export * from './registry';
export * from './definitions';
