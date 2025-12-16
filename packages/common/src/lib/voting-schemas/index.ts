/**
 * Voting schemas for use with RJSF.
 *
 * Usage:
 * ```tsx
 * import { simpleSchema, votingSchemas } from '@op/common/lib/voting-schemas';
 *
 * <Form
 *   schema={simpleSchema.formSchema}
 *   uiSchema={simpleSchema.uiSchema}
 *   formData={simpleSchema.defaults}
 *   validator={validator}
 * />
 * ```
 */

export * from './types';
export * from './definitions';
