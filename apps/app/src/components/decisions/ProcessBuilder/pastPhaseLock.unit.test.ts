import { describe, expect, it } from 'vitest';

import { getPastPhaseLock } from './pastPhaseLock';

const phases = [
  { phaseId: 'submission' },
  { phaseId: 'review' },
  { phaseId: 'voting' },
  { phaseId: 'results' },
];

describe('getPastPhaseLock', () => {
  it('locks nothing on a draft decision', () => {
    const lock = getPastPhaseLock({
      isDraft: true,
      currentStateId: 'voting',
      phases,
    });

    expect(lock.isLocked).toBe(false);
    expect(phases.some(({ phaseId }) => lock.isPhaseLocked(phaseId))).toBe(
      false,
    );
    expect(phases.some(({ phaseId }) => lock.isPastPhase(phaseId))).toBe(false);
  });

  it('locks nothing when the decision has no current phase', () => {
    const lock = getPastPhaseLock({
      isDraft: false,
      currentStateId: null,
      phases,
    });

    expect(lock.isLocked).toBe(false);
    expect(lock.isPhaseLocked('submission')).toBe(false);
  });

  it('fully locks the phases before the current one', () => {
    const lock = getPastPhaseLock({
      isDraft: false,
      currentStateId: 'voting',
      phases,
    });

    expect(lock.isLocked).toBe(true);
    expect(lock.currentPhaseId).toBe('voting');
    expect(lock.isPastPhase('submission')).toBe(true);
    expect(lock.isPastPhase('review')).toBe(true);
    expect(lock.isPhaseLocked('submission')).toBe(true);
    expect(lock.isPhaseLocked('review')).toBe(true);
  });

  it('pins the current phase in place without treating it as past', () => {
    const lock = getPastPhaseLock({
      isDraft: false,
      currentStateId: 'voting',
      phases,
    });

    expect(lock.isPhaseLocked('voting')).toBe(true);
    expect(lock.isPastPhase('voting')).toBe(false);
  });

  it('leaves the phases after the current one free', () => {
    const lock = getPastPhaseLock({
      isDraft: false,
      currentStateId: 'voting',
      phases,
    });

    expect(lock.isPhaseLocked('results')).toBe(false);
    expect(lock.isPastPhase('results')).toBe(false);
  });

  it('leaves a phase added since the last save free', () => {
    const lock = getPastPhaseLock({
      isDraft: false,
      currentStateId: 'voting',
      phases,
    });

    expect(lock.isPhaseLocked('unsaved')).toBe(false);
  });

  it('locks every phase when the current phase is missing', () => {
    const lock = getPastPhaseLock({
      isDraft: false,
      currentStateId: 'deleted',
      phases,
    });

    expect(lock.isLocked).toBe(true);
    expect(phases.every(({ phaseId }) => lock.isPastPhase(phaseId))).toBe(true);
  });
});
