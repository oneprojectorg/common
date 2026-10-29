import { describe, expect, it } from 'vitest';

import {
  assertAllocationsWithinBudget,
  getProcessBudget,
  redactHiddenBudget,
  templateCollectsBudget,
} from './templateBudget';
import type { ProposalTemplateSchema } from './types';

describe('templateCollectsBudget', () => {
  it('returns true when the template has a budget property', () => {
    const template: ProposalTemplateSchema = {
      type: 'object',
      properties: {
        title: { type: 'string', 'x-format': 'short-text' },
        budget: { type: 'object', 'x-format': 'money' },
      },
    };

    expect(templateCollectsBudget(template)).toBe(true);
  });

  it('returns false for null, undefined and a template without a budget', () => {
    expect(templateCollectsBudget(null)).toBe(false);
    expect(templateCollectsBudget(undefined)).toBe(false);
    expect(templateCollectsBudget({ type: 'object' })).toBe(false);
  });
});

describe('getProcessBudget', () => {
  const phases = [
    { phaseId: 'submission', settings: { budget: 25000 } },
    { phaseId: 'review', settings: {} },
    { phaseId: 'final', settings: { budget: 30000 } },
  ];

  it('reads the budget of the current phase', () => {
    expect(getProcessBudget({ phases, currentPhaseId: 'final' })).toBe(30000);
  });

  it('falls back to the first phase that has a budget when the current phase has none', () => {
    expect(getProcessBudget({ phases, currentPhaseId: 'review' })).toBe(25000);
  });

  it('falls back to the first phase that has a budget when no phase is current', () => {
    expect(getProcessBudget({ phases, currentPhaseId: null })).toBe(25000);
    expect(getProcessBudget({ phases, currentPhaseId: undefined })).toBe(25000);
  });

  it('returns undefined when no phase has a budget', () => {
    expect(
      getProcessBudget({
        phases: [{ phaseId: 'final' }, { phaseId: 'review', settings: {} }],
        currentPhaseId: 'final',
      }),
    ).toBeUndefined();
    expect(getProcessBudget({ phases: [], currentPhaseId: 'final' })).toBe(
      undefined,
    );
    expect(
      getProcessBudget({ phases: undefined, currentPhaseId: 'final' }),
    ).toBeUndefined();
  });

  it('ignores a budget that is not a positive finite number', () => {
    expect(
      getProcessBudget({
        phases: [
          { phaseId: 'final', settings: { budget: '25000' } },
          { phaseId: 'review', settings: { budget: 0 } },
          { phaseId: 'voting', settings: { budget: Number.NaN } },
          { phaseId: 'last', settings: { budget: 1200 } },
        ],
        currentPhaseId: 'final',
      }),
    ).toBe(1200);
  });

  it('skips the budget stripped to undefined when the instance hides it', () => {
    expect(
      getProcessBudget({
        phases: [{ phaseId: 'final', settings: { budget: undefined } }],
        currentPhaseId: 'final',
      }),
    ).toBeUndefined();
  });
});

describe('assertAllocationsWithinBudget', () => {
  const allocations = [
    { proposalId: 'a', amount: 12000 },
    { proposalId: 'b', amount: 8200 },
  ];

  it('rejects awards whose total exceeds the process budget', () => {
    expect(() =>
      assertAllocationsWithinBudget({ allocations, processBudget: 20000 }),
    ).toThrow('Awarded amounts total 20200, over the process budget of 20000');
  });

  it('accepts awards that exactly meet the process budget', () => {
    expect(() =>
      assertAllocationsWithinBudget({ allocations, processBudget: 20200 }),
    ).not.toThrow();
  });

  it('accepts any total when the process has no budget', () => {
    expect(() =>
      assertAllocationsWithinBudget({ allocations, processBudget: undefined }),
    ).not.toThrow();
  });

  it('accepts a submission that carries no awards', () => {
    expect(() =>
      assertAllocationsWithinBudget({
        allocations: undefined,
        processBudget: 1,
      }),
    ).not.toThrow();
  });
});

describe('redactHiddenBudget', () => {
  it('strips every phase budget and the top-level budget when the config hides the budget', () => {
    const redacted = redactHiddenBudget({
      config: { hideBudget: true },
      budget: 25000,
      phases: [
        { settings: { budget: 25000, other: 'kept' } },
        { settings: { budget: 9000 } },
        { settings: undefined },
      ],
    });

    expect(redacted.budget).toBeUndefined();
    expect(redacted.phases?.[0]?.settings).toMatchObject({ other: 'kept' });
    expect(redacted.phases?.[0]?.settings?.budget).toBeUndefined();
    expect(redacted.phases?.[1]?.settings?.budget).toBeUndefined();
    expect(redacted.phases?.[2]?.settings).toBeUndefined();
  });

  it('strips the budgets when only the legacy top-level hideBudget flag is set', () => {
    const redacted = redactHiddenBudget({
      hideBudget: true,
      budget: 25000,
      phases: [{ settings: { budget: 25000 } }],
    });

    expect(redacted.budget).toBeUndefined();
    expect(redacted.phases?.[0]?.settings?.budget).toBeUndefined();
  });

  it('returns the input untouched when the budget is not hidden', () => {
    const instanceData = {
      config: { hideBudget: false },
      budget: 25000,
      phases: [{ settings: { budget: 25000 } }],
    };

    expect(redactHiddenBudget(instanceData)).toBe(instanceData);
  });
});
