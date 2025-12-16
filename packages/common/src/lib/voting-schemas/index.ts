/**
 * Voting schemas for use with RJSF.
 *
 * Usage:
 * ```tsx
 * import { simpleSchema } from '@op/common/lib/voting-schemas';
 *
 * <Form
 *   schema={simpleSchema.process}
 *   uiSchema={simpleSchema.uiSchema}
 *   formData={simpleSchema.defaults}
 *   validator={validator}
 * />
 * ```
 */

export * from './types';
export * from './definitions';
