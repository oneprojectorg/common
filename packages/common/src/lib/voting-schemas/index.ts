/**
 * Voting schemas for use with RJSF.
 *
 * Usage:
 * ```tsx
 * import { simpleSchema } from '@op/common/lib/voting-schemas';
 *
 * // Access phases
 * const votingPhase = simpleSchema.phases.find(p => p.id === 'voting');
 *
 * // Use phase-specific config schema
 * <Form
 *   schema={votingPhase.configSchema}
 *   uiSchema={votingPhase.configUiSchema}
 *   formData={votingPhase.configDefaults}
 *   validator={validator}
 * />
 *
 * // Access phase selection pipeline
 * console.log(votingPhase.selectionPipeline);
 * ```
 */

export * from './types';
export * from './definitions';
