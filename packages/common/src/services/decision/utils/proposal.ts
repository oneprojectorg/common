import type { DecisionInstanceData, PhaseInstanceData } from '../schemas/instanceData';
import type { PhaseRules } from '../schemas/types';

/**
 * Deep-merges instance-level defaultRules with a phase's own rules.
 * Phase values take precedence over defaults.
 */
export function mergePhaseRules(
  defaultRules: PhaseRules | undefined,
  phaseRules: PhaseRules | undefined,
): PhaseRules {
  if (!defaultRules) {
    return phaseRules ?? {};
  }
  if (!phaseRules) {
    return defaultRules;
  }
  return {
    proposals: {
      ...defaultRules.proposals,
      ...phaseRules.proposals,
    },
    voting: {
      ...defaultRules.voting,
      ...phaseRules.voting,
    },
    advancement: phaseRules.advancement ?? defaultRules.advancement,
  };
}

/**
 * Helper to check if proposals are allowed in the current phase.
 * Reads from instanceData phases which now contain all template fields.
 */
export function checkProposalsAllowed(
  phases: PhaseInstanceData[],
  currentPhaseId: string,
): { allowed: boolean; phaseName: string } {
  const phase = phases.find((p) => p.phaseId === currentPhaseId);
  if (!phase) {
    return { allowed: false, phaseName: 'Unknown' };
  }
  const allowed = phase.rules?.proposals?.submit !== false;
  return { allowed, phaseName: phase.name ?? 'Unknown' };
}

/**
 * Returns true when proposals should be hidden by default in the given phase,
 * accounting for instance-level defaultRules merged with phase-specific rules.
 */
export function shouldDefaultHideProposals(
  instanceData: DecisionInstanceData,
  phaseId: string,
): boolean {
  const phase = instanceData.phases.find((p) => p.phaseId === phaseId);
  if (!phase) {
    return false;
  }
  const merged = mergePhaseRules(instanceData.defaultRules, phase.rules);
  return merged.proposals?.defaultHidden === true;
}
