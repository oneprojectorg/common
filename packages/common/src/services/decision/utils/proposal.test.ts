import { describe, expect, it } from 'vitest';

import type { DecisionInstanceData } from '../schemas/instanceData';
import type { PhaseRules } from '../schemas/types';
import { mergePhaseRules, shouldDefaultHideProposals } from './proposal';

describe('mergePhaseRules', () => {
  it('should return phase rules when no defaults', () => {
    const phaseRules: PhaseRules = {
      proposals: { submit: true, defaultHidden: true },
    };
    expect(mergePhaseRules(undefined, phaseRules)).toEqual(phaseRules);
  });

  it('should return defaults when no phase rules', () => {
    const defaults: PhaseRules = {
      proposals: { defaultHidden: true },
    };
    expect(mergePhaseRules(defaults, undefined)).toEqual(defaults);
  });

  it('should return empty object when both are undefined', () => {
    expect(mergePhaseRules(undefined, undefined)).toEqual({});
  });

  it('should deep-merge proposals with phase overriding defaults', () => {
    const defaults: PhaseRules = {
      proposals: { submit: true, defaultHidden: true },
    };
    const phaseRules: PhaseRules = {
      proposals: { defaultHidden: false },
    };
    const merged = mergePhaseRules(defaults, phaseRules);
    expect(merged.proposals?.submit).toBe(true);
    expect(merged.proposals?.defaultHidden).toBe(false);
  });

  it('should deep-merge voting with phase overriding defaults', () => {
    const defaults: PhaseRules = {
      voting: { submit: true, edit: true },
    };
    const phaseRules: PhaseRules = {
      voting: { edit: false },
    };
    const merged = mergePhaseRules(defaults, phaseRules);
    expect(merged.voting?.submit).toBe(true);
    expect(merged.voting?.edit).toBe(false);
  });

  it('should prefer phase advancement over default', () => {
    const defaults: PhaseRules = {
      advancement: { method: 'date', endDate: '2026-01-01' },
    };
    const phaseRules: PhaseRules = {
      advancement: { method: 'manual' },
    };
    const merged = mergePhaseRules(defaults, phaseRules);
    expect(merged.advancement?.method).toBe('manual');
  });
});

describe('shouldDefaultHideProposals', () => {
  const baseInstanceData: DecisionInstanceData = {
    phases: [
      { phaseId: 'phase-1', rules: { proposals: { submit: true } } },
      { phaseId: 'phase-2', rules: { proposals: { submit: true } } },
    ],
  };

  it('should return false when no defaultRules set', () => {
    expect(shouldDefaultHideProposals(baseInstanceData, 'phase-1')).toBe(false);
  });

  it('should return true when defaultRules has defaultHidden', () => {
    const data: DecisionInstanceData = {
      ...baseInstanceData,
      defaultRules: { proposals: { defaultHidden: true } },
    };
    expect(shouldDefaultHideProposals(data, 'phase-1')).toBe(true);
  });

  it('should return false when phase overrides defaultHidden to false', () => {
    const data: DecisionInstanceData = {
      defaultRules: { proposals: { defaultHidden: true } },
      phases: [
        {
          phaseId: 'phase-1',
          rules: { proposals: { submit: true, defaultHidden: false } },
        },
      ],
    };
    expect(shouldDefaultHideProposals(data, 'phase-1')).toBe(false);
  });

  it('should return false for unknown phase', () => {
    const data: DecisionInstanceData = {
      ...baseInstanceData,
      defaultRules: { proposals: { defaultHidden: true } },
    };
    expect(shouldDefaultHideProposals(data, 'nonexistent')).toBe(false);
  });
});
