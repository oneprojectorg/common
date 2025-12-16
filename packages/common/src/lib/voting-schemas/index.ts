/**
 * Voting schemas - phase-based decision process definitions.
 *
 * Usage:
 * ```tsx
 * import { simpleSchema } from '@op/common/lib/voting-schemas';
 *
 * // Access phases
 * const votingPhase = simpleSchema.phases.find(p => p.id === 'voting');
 *
 * // Check phase behavior
 * console.log(votingPhase?.config.allowDecisions); // true
 *
 * // Get phase-specific form schema (for RJSF)
 * console.log(votingPhase?.configSchema);
 *
 * // Get selection pipeline for phase transitions
 * console.log(votingPhase?.selectionPipeline);
 * ```
 */

export * from './types';
export * from './definitions';
