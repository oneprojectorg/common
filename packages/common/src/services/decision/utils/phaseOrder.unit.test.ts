import { describe, expect, it } from 'vitest';

import {
  getPhaseIndex,
  getPreviousPhases,
  hasPhaseEnded,
  isPhaseAtOrBefore,
} from './phaseOrder';

const instanceData = {
  phases: [
    { phaseId: 'submission' },
    { phaseId: 'feasibility' },
    { phaseId: 'community' },
    { phaseId: 'results' },
  ],
};

describe('getPhaseIndex', () => {
  it('returns the position of the phase in the ordering', () => {
    expect(getPhaseIndex(instanceData, 'submission')).toBe(0);
    expect(getPhaseIndex(instanceData, 'community')).toBe(2);
  });

  it('returns -1 for a phase not configured on the instance', () => {
    expect(getPhaseIndex(instanceData, 'missing')).toBe(-1);
  });

  it('returns -1 when the instance has no phases', () => {
    expect(getPhaseIndex({ phases: [] }, 'submission')).toBe(-1);
    expect(getPhaseIndex({}, 'submission')).toBe(-1);
  });
});

describe('isPhaseAtOrBefore', () => {
  it('is true for an earlier phase', () => {
    expect(isPhaseAtOrBefore(instanceData, 'feasibility', 'community')).toBe(
      true,
    );
  });

  it('is true for the same phase', () => {
    expect(isPhaseAtOrBefore(instanceData, 'community', 'community')).toBe(
      true,
    );
  });

  it('is false for a later phase', () => {
    expect(isPhaseAtOrBefore(instanceData, 'results', 'community')).toBe(false);
  });

  it('fails closed when the target phase is not configured', () => {
    expect(isPhaseAtOrBefore(instanceData, 'missing', 'community')).toBe(false);
  });

  it('fails closed when the reference phase is not configured', () => {
    expect(isPhaseAtOrBefore(instanceData, 'submission', 'missing')).toBe(
      false,
    );
  });
});

describe('getPreviousPhases', () => {
  it('returns the earlier phases in phase order', () => {
    expect(getPreviousPhases(instanceData, 'community')).toEqual([
      { phaseId: 'submission' },
      { phaseId: 'feasibility' },
    ]);
  });

  it('returns an empty list for the first phase', () => {
    expect(getPreviousPhases(instanceData, 'submission')).toEqual([]);
  });

  it('returns an empty list for a phase not configured on the instance', () => {
    expect(getPreviousPhases(instanceData, 'missing')).toEqual([]);
  });

  it('preserves the full phase entries, not just ids', () => {
    const withRules = {
      phases: [
        { phaseId: 'a', rules: { reviews: { submit: true } } },
        { phaseId: 'b' },
      ],
    };

    expect(getPreviousPhases(withRules, 'b')).toEqual([
      { phaseId: 'a', rules: { reviews: { submit: true } } },
    ]);
  });
});

describe('hasPhaseEnded', () => {
  it('is true for a phase the instance has moved past', () => {
    expect(hasPhaseEnded(instanceData, 'feasibility', 'community')).toBe(true);
  });

  it('is false for the current phase', () => {
    expect(hasPhaseEnded(instanceData, 'community', 'community')).toBe(false);
  });

  it('is false for a later phase', () => {
    expect(hasPhaseEnded(instanceData, 'results', 'community')).toBe(false);
  });

  it('is false when either phase is not configured', () => {
    expect(hasPhaseEnded(instanceData, 'missing', 'community')).toBe(false);
    expect(hasPhaseEnded(instanceData, 'submission', 'missing')).toBe(false);
  });

  it('is false when the instance has no current phase', () => {
    expect(hasPhaseEnded(instanceData, 'submission', null)).toBe(false);
    expect(hasPhaseEnded(instanceData, 'submission', undefined)).toBe(false);
  });
});
