import { describe, expect, it } from 'vitest';

import {
  parseProposalData,
  parseProposalDataWithBudgetCurrency,
} from './proposalDataSchema';
import {
  DEFAULT_BUDGET_CURRENCY,
  getBudgetCurrency,
  getStoredBudgetCurrency,
  getTemplateBudgetCurrency,
  resolveBudgetFallbackCurrency,
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

describe('getStoredBudgetCurrency', () => {
  it('reads a currency the proposal genuinely stored', () => {
    expect(
      getStoredBudgetCurrency({ budget: { amount: 5000, currency: 'CAD' } }),
    ).toBe('CAD');
  });

  it('reports none for budgets that name none', () => {
    // Legacy bare number, the `{amount}`-only shape, a blank code, a cleared
    // budget, and junk from an import — none of these tell us a currency.
    expect(getStoredBudgetCurrency({ budget: 5000 })).toBeUndefined();
    expect(
      getStoredBudgetCurrency({ budget: { amount: 5000 } }),
    ).toBeUndefined();
    expect(
      getStoredBudgetCurrency({ budget: { amount: 5000, currency: '' } }),
    ).toBeUndefined();
    expect(getStoredBudgetCurrency({ budget: null })).toBeUndefined();
    expect(getStoredBudgetCurrency({})).toBeUndefined();
    expect(getStoredBudgetCurrency(null)).toBeUndefined();
    expect(getStoredBudgetCurrency('nonsense')).toBeUndefined();
  });
});

describe('resolveBudgetFallbackCurrency', () => {
  const eurTemplate: ProposalTemplateSchema = {
    type: 'object',
    properties: {
      budget: {
        type: 'object',
        'x-format': 'money',
        properties: { currency: { type: 'string', default: 'EUR' } },
      },
    },
  };

  it('keeps a stored currency rather than relabelling with the template', () => {
    // The template's currency is editable long after proposals are submitted,
    // so letting it win would silently re-denominate a $5,000 request as
    // €5,000 with no conversion the moment an admin switches the picker.
    expect(
      resolveBudgetFallbackCurrency(
        { budget: { amount: 5000, currency: 'USD' } },
        eurTemplate,
      ),
    ).toBe('USD');
  });

  it('falls back to the template for a legacy bare-number budget', () => {
    // The regression this whole helper exists for. `budgetValueSchema` stamps
    // USD onto a bare number, so reading a *parsed* budget here would hand
    // back 'USD' and render dollars on a EUR process — which is the original
    // bug. Only the raw value still distinguishes the two.
    const raw = { budget: 5000 };
    expect(parseProposalData(raw).budget?.currency).toBe('USD');
    expect(resolveBudgetFallbackCurrency(raw, eurTemplate)).toBe('EUR');
  });

  it('falls back to the template for a budget with no currency', () => {
    expect(
      resolveBudgetFallbackCurrency({ budget: { amount: 5000 } }, eurTemplate),
    ).toBe('EUR');
    // A blank code is not something to trust either — `Intl` throws on it.
    expect(
      resolveBudgetFallbackCurrency(
        { budget: { amount: 5000, currency: '' } },
        eurTemplate,
      ),
    ).toBe('EUR');
    expect(resolveBudgetFallbackCurrency({}, eurTemplate)).toBe('EUR');
    expect(resolveBudgetFallbackCurrency(null, eurTemplate)).toBe('EUR');
  });

  it('defaults when neither the proposal nor the template names one', () => {
    expect(resolveBudgetFallbackCurrency({ budget: 5000 }, null)).toBe(
      DEFAULT_BUDGET_CURRENCY,
    );
  });
});

describe('parseProposalDataWithBudgetCurrency', () => {
  const eurTemplate: ProposalTemplateSchema = {
    type: 'object',
    properties: {
      budget: {
        type: 'object',
        'x-format': 'money',
        properties: { currency: { type: 'string', default: 'EUR' } },
      },
    },
  };

  it('replaces the fabricated USD with the process currency', () => {
    // What every server boundary must do before handing proposalData to a
    // client: once parsed, the fabricated USD is indistinguishable from a real
    // one, so no downstream reader can recover the process's currency.
    expect(
      parseProposalDataWithBudgetCurrency({ budget: 5000 }, eurTemplate),
    ).toMatchObject({ budget: { amount: 5000, currency: 'EUR' } });
  });

  it('leaves a genuinely stored currency alone', () => {
    expect(
      parseProposalDataWithBudgetCurrency(
        { budget: { amount: 5000, currency: 'USD' } },
        eurTemplate,
      ),
    ).toMatchObject({ budget: { amount: 5000, currency: 'USD' } });
  });

  it('adds no budget where there is none', () => {
    expect(
      parseProposalDataWithBudgetCurrency({ title: 'No budget' }, eurTemplate)
        .budget,
    ).toBeUndefined();
  });
});
