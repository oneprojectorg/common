import { describe, expect, it } from 'vitest';

import { getPastPhaseLock } from './pastPhaseLock';

const phases = [
  { phaseId: 'submission' },
  { phaseId: 'review' },
  { phaseId: 'voting' },
  { phaseId: 'results' },
];

const published = getPastPhaseLock({
  isDraft: false,
  currentStateId: 'voting',
  phases,
});

describe('getPastPhaseLock', () => {
  it('locks nothing on a draft decision', () => {
    const getLock = getPastPhaseLock({
      isDraft: true,
      currentStateId: 'voting',
      phases,
    });

    expect(phases.map(({ phaseId }) => getLock(phaseId))).toEqual([
      'free',
      'free',
      'free',
      'free',
    ]);
  });

  it('locks nothing when the decision has no current phase', () => {
    const getLock = getPastPhaseLock({
      isDraft: false,
      currentStateId: null,
      phases,
    });

    expect(getLock('submission')).toBe('free');
  });

  it('fully locks the phases before the current one', () => {
    expect(published('submission')).toBe('past');
    expect(published('review')).toBe('past');
  });

  it('pins the current phase in place without treating it as past', () => {
    expect(published('voting')).toBe('current');
  });

  it('leaves the phases after the current one free', () => {
    expect(published('results')).toBe('free');
  });

  it('leaves a phase added since the last save free', () => {
    expect(published('unsaved')).toBe('free');
  });

  it('locks every phase when the current phase is missing', () => {
    const getLock = getPastPhaseLock({
      isDraft: false,
      currentStateId: 'deleted',
      phases,
    });

    expect(phases.every(({ phaseId }) => getLock(phaseId) === 'past')).toBe(
      true,
    );
  });
});
