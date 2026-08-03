import { describe, expect, it } from 'vitest';

import {
  getNextPhase,
  getPhaseIndex,
  getPreviousPhase,
  getPreviousPhases,
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

  it('returns -1 for a nullish phase id', () => {
    expect(getPhaseIndex(instanceData, null)).toBe(-1);
    expect(getPhaseIndex(instanceData, undefined)).toBe(-1);
  });
});

describe('getNextPhase', () => {
  it('returns the phase immediately after the given phase', () => {
    expect(getNextPhase(instanceData, 'submission')).toEqual({
      phaseId: 'feasibility',
    });
    expect(getNextPhase(instanceData, 'community')).toEqual({
      phaseId: 'results',
    });
  });

  it('returns undefined for the final phase', () => {
    expect(getNextPhase(instanceData, 'results')).toBeUndefined();
  });

  it('returns undefined for a phase not configured on the instance', () => {
    expect(getNextPhase(instanceData, 'missing')).toBeUndefined();
  });

  it('returns undefined for a nullish phase id or missing phases', () => {
    expect(getNextPhase(instanceData, null)).toBeUndefined();
    expect(getNextPhase({}, 'submission')).toBeUndefined();
  });
});

describe('getPreviousPhase', () => {
  it('returns the phase immediately before the given phase', () => {
    expect(getPreviousPhase(instanceData, 'feasibility')).toEqual({
      phaseId: 'submission',
    });
    expect(getPreviousPhase(instanceData, 'results')).toEqual({
      phaseId: 'community',
    });
  });

  it('returns undefined for the first phase', () => {
    expect(getPreviousPhase(instanceData, 'submission')).toBeUndefined();
  });

  it('returns undefined for a phase not configured on the instance', () => {
    expect(getPreviousPhase(instanceData, 'missing')).toBeUndefined();
  });

  it('returns undefined for a nullish phase id or missing phases', () => {
    expect(getPreviousPhase(instanceData, null)).toBeUndefined();
    expect(getPreviousPhase({}, 'feasibility')).toBeUndefined();
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
