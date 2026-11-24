import { describe, expect, it } from 'vitest';

import { getPastPhaseLock, reorderFreePhases } from './pastPhaseLock';

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

const locksOf = (getLock: (phaseId: string) => string) =>
  phases.map(({ phaseId }) => getLock(phaseId));

describe('getPastPhaseLock', () => {
  it('locks nothing on a draft decision', () => {
    const lock = getPastPhaseLock({
      isDraft: true,
      currentStateId: 'voting',
      phases,
    });

    expect(locksOf(lock.getLock)).toEqual(['free', 'free', 'free', 'free']);
    expect(lock.canAddPhases).toBe(true);
  });

  it.each([null, undefined, ''])(
    'locks nothing when the current phase is %j',
    (currentStateId) => {
      const lock = getPastPhaseLock({
        isDraft: false,
        currentStateId,
        phases,
      });

      expect(locksOf(lock.getLock)).toEqual(['free', 'free', 'free', 'free']);
      expect(lock.canAddPhases).toBe(true);
    },
  );

  it('fully locks the phases before the current one', () => {
    expect(published.getLock('submission')).toBe('past');
    expect(published.getLock('review')).toBe('past');
  });

  it('pins the current phase in place without treating it as past', () => {
    expect(published.getLock('voting')).toBe('current');
  });

  it('leaves the phases after the current one free', () => {
    expect(published.getLock('results')).toBe('free');
  });

  it('leaves a phase added since the last save free', () => {
    expect(published.getLock('unsaved')).toBe('free');
    expect(published.canAddPhases).toBe(true);
  });

  it('locks nothing as past when the first phase is current', () => {
    const lock = getPastPhaseLock({
      isDraft: false,
      currentStateId: 'submission',
      phases,
    });

    expect(locksOf(lock.getLock)).toEqual(['current', 'free', 'free', 'free']);
  });

  it('leaves nothing free when the last phase is current', () => {
    const lock = getPastPhaseLock({
      isDraft: false,
      currentStateId: 'results',
      phases,
    });

    expect(locksOf(lock.getLock)).toEqual(['past', 'past', 'past', 'current']);
  });

  it('locks every phase, and refuses new ones, when the current phase is missing', () => {
    const lock = getPastPhaseLock({
      isDraft: false,
      currentStateId: 'deleted',
      phases,
    });

    expect(locksOf(lock.getLock)).toEqual(['past', 'past', 'past', 'past']);
    expect(lock.getLock('unsaved')).toBe('past');
    expect(lock.canAddPhases).toBe(false);
  });

  it('locks everything when a published decision has no phases', () => {
    const lock = getPastPhaseLock({
      isDraft: false,
      currentStateId: 'voting',
      phases: undefined,
    });

    expect(lock.getLock('voting')).toBe('past');
    expect(lock.canAddPhases).toBe(false);
  });
});

describe('reorderFreePhases', () => {
  const rows = [
    { id: 'submission' },
    { id: 'review' },
    { id: 'voting' },
    { id: 'results' },
    { id: 'unsaved' },
  ];
  const { getLock } = published;
  const ids = (list: { id: string }[]) => list.map(({ id }) => id);

  it('reorders the free phases after the locked prefix', () => {
    const reordered = reorderFreePhases(
      rows,
      [{ id: 'unsaved' }, { id: 'results' }],
      getLock,
    );

    expect(ids(reordered)).toEqual([
      'submission',
      'review',
      'voting',
      'unsaved',
      'results',
    ]);
  });

  it('keeps a locked phase in its place when the reorder tries to move it', () => {
    const reordered = reorderFreePhases(
      rows,
      [{ id: 'results' }, { id: 'review' }, { id: 'unsaved' }],
      getLock,
    );

    expect(ids(reordered)).toEqual([
      'submission',
      'review',
      'voting',
      'results',
      'unsaved',
    ]);
  });
});
