import { describe, expect, it } from 'vitest';

import { parseProposalData } from './proposalDataSchema';
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

  it('ignores a blank default rather than returning an unusable code', () => {
    // A blank code is not a currency: `Intl` throws on it, so returning it
    // would strip the symbol from every budget on the process instead of
    // falling back the way a `null` default already does.
    for (const blank of ['', '   ']) {
      expect(
        getBudgetCurrency({
          type: 'object',
          'x-format': 'money',
          properties: { currency: { type: 'string', default: blank } },
        }),
      ).toBe(DEFAULT_BUDGET_CURRENCY);
    }
  });

  it('trims a padded default', () => {
    expect(
      getBudgetCurrency({
        type: 'object',
        'x-format': 'money',
        properties: { currency: { type: 'string', default: ' EUR ' } },
      }),
    ).toBe('EUR');
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

  it('reads a currency out of parsed proposalData too', () => {
    // The schema is structural so both forms work — `budgetValueSchema` no
    // longer invents a code, so a parsed budget is as honest as the raw JSON
    // about whether the author named one.
    expect(
      getStoredBudgetCurrency(
        parseProposalData({ budget: { amount: 5000, currency: 'CAD' } }),
      ),
    ).toBe('CAD');
    expect(getStoredBudgetCurrency(parseProposalData({ budget: 5000 }))).toBe(
      undefined,
    );
  });

  it('reports none for budgets that name none', () => {
    // Legacy bare number, the `{amount}`-only shape, a blank code, a cleared
    // budget, and junk from an import — none of these tell us a currency.
    expect(getStoredBudgetCurrency({ budget: 5000 })).toBeUndefined();
    expect(
      getStoredBudgetCurrency({ budget: { amount: 5000, currency: '  ' } }),
    ).toBeUndefined();
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
    // The regression this whole helper exists for. A bare number names no
    // currency, so it must take the process's — and `budgetValueSchema` has to
    // leave it absent for that to be knowable at all. Stamping a default here
    // was the original bug: a fabricated 'USD' outranks the template and
    // renders dollars on a EUR process.
    const raw = { budget: 5000 };
    expect(parseProposalData(raw).budget).toEqual({ amount: 5000 });
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
