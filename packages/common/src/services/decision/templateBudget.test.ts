import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BUDGET_CURRENCY,
  getBudgetCurrency,
  getTemplateBudgetCurrency,
} from './templateBudget';
import type { ProposalTemplateSchema } from './types';

describe('getBudgetCurrency', () => {
  it('reads the currency the process was configured with', () => {
    expect(
      getBudgetCurrency({
        type: 'object',
        'x-format': 'money',
        properties: {
          amount: { type: 'number' },
          currency: { type: 'string', default: 'EUR' },
        },
      }),
    ).toBe('EUR');
  });

  it('falls back to the default when the budget field configures none', () => {
    // Legacy `{type: 'number'}` budgets and object budgets written before the
    // currency picker existed both land here.
    expect(getBudgetCurrency({ type: 'number', 'x-format': 'money' })).toBe(
      DEFAULT_BUDGET_CURRENCY,
    );
    expect(
      getBudgetCurrency({
        type: 'object',
        'x-format': 'money',
        properties: { amount: { type: 'number' } },
      }),
    ).toBe(DEFAULT_BUDGET_CURRENCY);
    expect(getBudgetCurrency(undefined)).toBe(DEFAULT_BUDGET_CURRENCY);
  });

  it('tolerates a null currency sub-schema instead of throwing', () => {
    // Templates are arbitrary JSON out of the database and `typeof null` is
    // 'object', so this reaches the dereference. Both callers run during
    // render, where throwing blanks the page into an error boundary.
    expect(
      getBudgetCurrency({
        type: 'object',
        'x-format': 'money',
        properties: { currency: null },
      }),
    ).toBe(DEFAULT_BUDGET_CURRENCY);
  });

  it('ignores a non-string default', () => {
    expect(
      getBudgetCurrency({
        type: 'object',
        'x-format': 'money',
        properties: { currency: { type: 'string', default: 42 } },
      }),
    ).toBe(DEFAULT_BUDGET_CURRENCY);
  });
});

describe('getTemplateBudgetCurrency', () => {
  const template: ProposalTemplateSchema = {
    type: 'object',
    properties: {
      budget: {
        type: 'object',
        'x-format': 'money',
        properties: { currency: { type: 'string', default: 'GBP' } },
      },
    },
  };

  it('resolves through the template', () => {
    expect(getTemplateBudgetCurrency(template)).toBe('GBP');
  });

  it('defaults for a template with no budget field', () => {
    expect(getTemplateBudgetCurrency({ type: 'object', properties: {} })).toBe(
      DEFAULT_BUDGET_CURRENCY,
    );
    expect(getTemplateBudgetCurrency(null)).toBe(DEFAULT_BUDGET_CURRENCY);
    expect(getTemplateBudgetCurrency(undefined)).toBe(DEFAULT_BUDGET_CURRENCY);
  });
});
