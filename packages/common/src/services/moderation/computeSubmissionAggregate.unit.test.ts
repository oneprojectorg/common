import { describe, expect, it } from 'vitest';

import {
  computeSubmissionAggregate,
  mergeSubmissionScores,
} from './submissionAggregate';

describe('computeSubmissionAggregate', () => {
  it('reports all-resolved-clear when every task is clear', () => {
    const aggregate = computeSubmissionAggregate([
      { verdict: 'clear' },
      { verdict: 'clear' },
    ]);

    expect(aggregate).toEqual({
      anyFlagged: false,
      anyPending: false,
      allResolved: true,
      scores: undefined,
      reason: undefined,
      externalRecordId: undefined,
    });
  });

  it('stays pending (not resolved) while any task is pending', () => {
    const aggregate = computeSubmissionAggregate([
      { verdict: 'clear' },
      { verdict: 'pending' },
    ]);

    expect(aggregate.anyPending).toBe(true);
    expect(aggregate.allResolved).toBe(false);
    expect(aggregate.anyFlagged).toBe(false);
  });

  it('flags if any task flagged, even with others pending', () => {
    const aggregate = computeSubmissionAggregate([
      { verdict: 'flagged', reason: 'hate' },
      { verdict: 'pending' },
    ]);

    expect(aggregate.anyFlagged).toBe(true);
    expect(aggregate.anyPending).toBe(true);
    expect(aggregate.allResolved).toBe(false);
  });

  it('merges evidence across flagged tasks: worst score per category, joined reasons, first record id', () => {
    const aggregate = computeSubmissionAggregate([
      {
        verdict: 'flagged',
        scores: { hate: 0.4, violence: 0.9 },
        reason: 'text rule',
        externalRecordId: 'task-1',
      },
      { verdict: 'clear', scores: { hate: 1 }, reason: 'ignored (clear)' },
      {
        verdict: 'flagged',
        scores: { hate: 0.8 },
        reason: 'image rule',
        externalRecordId: 'task-2',
      },
    ]);

    expect(aggregate.scores).toEqual({ hate: 0.8, violence: 0.9 });
    expect(aggregate.reason).toBe('text rule; image rule');
    expect(aggregate.externalRecordId).toBe('task-1');
  });

  it('ignores evidence from clear/pending tasks', () => {
    const aggregate = computeSubmissionAggregate([
      { verdict: 'clear', scores: { hate: 1 }, reason: 'x' },
      { verdict: 'pending', scores: { violence: 1 }, reason: 'y' },
    ]);

    expect(aggregate.scores).toBeUndefined();
    expect(aggregate.reason).toBeUndefined();
  });

  it('treats an empty round as resolved with nothing flagged', () => {
    const aggregate = computeSubmissionAggregate([]);

    expect(aggregate).toMatchObject({
      anyFlagged: false,
      anyPending: false,
      allResolved: true,
    });
  });
});

describe('mergeSubmissionScores', () => {
  it('keeps the max score per category across maps', () => {
    expect(
      mergeSubmissionScores({ hate: 0.2, sexual: 0.9 }, { hate: 0.7 }),
    ).toEqual({ hate: 0.7, sexual: 0.9 });
  });

  it('returns the base untouched when next is null/undefined', () => {
    expect(mergeSubmissionScores({ hate: 0.5 }, null)).toEqual({ hate: 0.5 });
    expect(mergeSubmissionScores(undefined, undefined)).toBeUndefined();
  });

  it('drops non-finite scores', () => {
    expect(
      mergeSubmissionScores({}, { hate: Number.NaN, violence: 0.3 }),
    ).toEqual({
      violence: 0.3,
    });
  });
});
