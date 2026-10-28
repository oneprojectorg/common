import { describe, expect, it } from 'vitest';

import {
  isSavableProcessBudget,
  toPhasesWithBudget,
} from './processBudgetPatch';

const submission = {
  phaseId: 'submission',
  name: 'Submission',
  description: 'Members submit proposals.',
  headline: 'Submit your ideas',
  additionalInfo: 'More',
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: '2026-02-01T00:00:00.000Z',
  rules: { proposals: { submit: true } },
  settings: { allowComments: true },
};

const final = {
  phaseId: 'final',
  name: 'Final',
  rules: { proposals: { submit: false } },
};

describe('toPhasesWithBudget', () => {
  it('writes the budget into the first phase settings and keeps its other settings', () => {
    expect(toPhasesWithBudget([submission, final], 25000)).toEqual([
      { ...submission, settings: { allowComments: true, budget: 25000 } },
      final,
    ]);
  });

  it('sends every phase so the server keeps the ones the budget does not touch', () => {
    const phases = toPhasesWithBudget([submission, final], 25000);

    expect(phases?.map((phase) => phase.phaseId)).toEqual([
      'submission',
      'final',
    ]);
    expect(phases?.[1]).toEqual(final);
  });

  it('removes the budget key when the amount is cleared', () => {
    const withBudget = {
      ...submission,
      settings: { allowComments: true, budget: 25000 },
    };

    expect(toPhasesWithBudget([withBudget, final], null)).toEqual([
      { ...submission, settings: { allowComments: true } },
      final,
    ]);
  });

  it('adds a settings object to a first phase that had none', () => {
    const bare = { phaseId: 'only', name: 'Only' };

    expect(toPhasesWithBudget([bare], 100)).toEqual([
      { ...bare, settings: { budget: 100 } },
    ]);
  });

  it('gives no patch when the process has no phases', () => {
    expect(toPhasesWithBudget([], 100)).toBeUndefined();
  });
});

describe('isSavableProcessBudget', () => {
  it('accepts a cleared budget and a positive amount', () => {
    expect(isSavableProcessBudget(null)).toBe(true);
    expect(isSavableProcessBudget(25000)).toBe(true);
    expect(isSavableProcessBudget(0.5)).toBe(true);
  });

  it('refuses zero, negative and non-finite amounts so they never replace a saved budget', () => {
    expect(isSavableProcessBudget(0)).toBe(false);
    expect(isSavableProcessBudget(-5)).toBe(false);
    expect(isSavableProcessBudget(Number.NaN)).toBe(false);
    expect(isSavableProcessBudget(Number.POSITIVE_INFINITY)).toBe(false);
  });
});
