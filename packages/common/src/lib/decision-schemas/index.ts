/**
 * Decision templates - phase-based decision process definitions.
 *
 * Usage:
 * ```tsx
 * import { simpleVoting } from '@op/common/lib/decision-schemas';
 *
 * // Access phases
 * const votingPhase = simpleVoting.phases.find(p => p.id === 'voting');
 *
 * // Check phase behavior rules
 * console.log(votingPhase?.rules.voting?.submit); // true
 *
 * // Get phase-specific form schema (for RJSF)
 * console.log(votingPhase?.settings);
 *
 * // Get selection pipeline for phase transitions
 * console.log(votingPhase?.selectionPipeline);
 * ```
 */

export * from './types';
export * from './definitions';
export * from './instanceData';
