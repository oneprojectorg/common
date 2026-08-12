import { describe, expect, it } from 'vitest';

import {
  assembleProposalData,
  resolveSystemFieldOverrides,
  toValidationBudget,
} from './assembleProposalData';
import {
  isDistrictCategoryLabel,
  normalizeBudget,
  normalizeLocation,
  normalizeProposalCategories,
  parseProposalData,
  parseSchemaOptions,
  parseStoredBudgetFragmentValue,
  withStoredBudgetCurrency,
} from './proposalDataSchema';
import type { ProposalTemplateSchema } from './types';

describe('proposalDataSchema category normalization', () => {
  it('normalizes serialized category arrays into string arrays', () => {
    expect(
      normalizeProposalCategories('["Housing", "Public Transit"]'),
    ).toEqual(['Housing', 'Public Transit']);
  });

  it('falls back to a single category when the string is not JSON', () => {
    expect(normalizeProposalCategories('just one')).toEqual(['just one']);
  });

  it('trims and deduplicates parsed category values', () => {
    expect(
      normalizeProposalCategories('["  alpha ", "beta", "alpha"]'),
    ).toEqual(['alpha', 'beta']);
  });

  it('parses serialized category arrays from proposal data', () => {
    const result = parseProposalData({
      title: 'Serialized categories',
      category: '["Housing", "Public Transit"]',
    });

    expect(result.category).toEqual(['Housing', 'Public Transit']);
  });
});

describe('parseSchemaOptions', () => {
  it('passes per-option descriptions through from canonical oneOf entries', () => {
    const options = parseSchemaOptions({
      type: 'string',
      'x-format': 'dropdown',
      oneOf: [
        { const: 'a1', title: 'Yes', description: 'Feasible as scoped' },
        { const: 'b2', title: 'Maybe' },
      ],
    });

    expect(options).toEqual([
      { value: 'a1', title: 'Yes', description: 'Feasible as scoped' },
      { value: 'b2', title: 'Maybe' },
    ]);
    expect('description' in (options[1] ?? {})).toBe(false);
  });
});

describe('isDistrictCategoryLabel', () => {
  it('matches boundary-derived "District N" labels regardless of case or surrounding whitespace', () => {
    expect(isDistrictCategoryLabel('District 1')).toBe(true);
    expect(isDistrictCategoryLabel('District 10')).toBe(true);
    expect(isDistrictCategoryLabel('district 7')).toBe(true);
    expect(isDistrictCategoryLabel('DISTRICT 3')).toBe(true);
    expect(isDistrictCategoryLabel('  District 2  ')).toBe(true);
  });

  it('does not match category labels that merely contain the word district', () => {
    expect(isDistrictCategoryLabel('Parks')).toBe(false);
    expect(isDistrictCategoryLabel('District')).toBe(false);
    expect(isDistrictCategoryLabel('Districts 2')).toBe(false);
    expect(isDistrictCategoryLabel('District One')).toBe(false);
    expect(isDistrictCategoryLabel('West District 1')).toBe(false);
    expect(isDistrictCategoryLabel('District 1 Cleanup')).toBe(false);
  });
});

describe('normalizeLocation', () => {
  it('accepts a valid lat/lng pair', () => {
    expect(normalizeLocation({ lat: 12.34, lng: -56.78 })).toEqual({
      lat: 12.34,
      lng: -56.78,
    });
  });

  it('preserves an optional address', () => {
    expect(
      normalizeLocation({ lat: 1, lng: 2, address: '123 Main St' }),
    ).toEqual({ lat: 1, lng: 2, address: '123 Main St' });
  });

  it('rejects out-of-bounds coordinates', () => {
    expect(normalizeLocation({ lat: 91, lng: 0 })).toBeUndefined();
    expect(normalizeLocation({ lat: -91, lng: 0 })).toBeUndefined();
    expect(normalizeLocation({ lat: 0, lng: 181 })).toBeUndefined();
    expect(normalizeLocation({ lat: 0, lng: -181 })).toBeUndefined();
  });

  it('rejects malformed values without throwing', () => {
    expect(normalizeLocation('not a location')).toBeUndefined();
    expect(normalizeLocation({ lat: 'a', lng: 'b' })).toBeUndefined();
    expect(normalizeLocation({ lat: 1 })).toBeUndefined();
    expect(normalizeLocation(null)).toBeUndefined();
    expect(normalizeLocation(undefined)).toBeUndefined();
  });

  it('parses location from proposal data', () => {
    const result = parseProposalData({
      title: 'With location',
      location: { lat: 40.7, lng: -74 },
    });

    expect(result.location).toEqual({ lat: 40.7, lng: -74 });
  });
});

describe('assembleProposalData dropdown fields', () => {
  // The dropdown form field commits the option's raw `const` value into the
  // Yjs fragment. The validator must hand AJV that exact string so `oneOf`
  // matches — otherwise users see "X is invalid" for a value they selected
  // from the dropdown. ONE-289 was caused by a `.trim()` in the validator
  // read path that silently stripped whitespace from option consts (often
  // introduced on the last option, where authors press Enter or paste).
  const dropdownTemplate: ProposalTemplateSchema = {
    type: 'object',
    properties: {
      submitting: {
        type: ['string', 'null'],
        title: 'How are you submitting your idea?',
        'x-format': 'dropdown',
        oneOf: [
          { const: 'org', title: 'Submitting through an organization' },
          { const: 'individual ', title: 'Submitting on my own ' },
        ],
      },
    },
    required: ['submitting'],
  };

  it('preserves an exact dropdown value with trailing whitespace — ONE-289', () => {
    const data = assembleProposalData(dropdownTemplate, {
      submitting: 'individual ',
    });

    expect(data).toEqual({ submitting: 'individual ' });
  });
});

describe('assembleProposalData location fields', () => {
  const template: ProposalTemplateSchema = {
    type: 'object',
    properties: {
      location: {
        type: 'object',
        'x-format': 'location',
        properties: {
          lat: { type: 'number', minimum: -90, maximum: 90 },
          lng: { type: 'number', minimum: -180, maximum: 180 },
        },
        required: ['lat', 'lng'],
      },
    },
  };

  it('parses a JSON location fragment', () => {
    expect(
      assembleProposalData(template, { location: '{"lat":1.5,"lng":-2.5}' }),
    ).toEqual({ location: { lat: 1.5, lng: -2.5 } });
  });

  it('passes malformed JSON through as a raw string', () => {
    expect(assembleProposalData(template, { location: 'not json' })).toEqual({
      location: 'not json',
    });
  });

  it('omits the key for empty fragments', () => {
    expect(assembleProposalData(template, { location: '' })).toEqual({});
    expect(assembleProposalData(template, {})).toEqual({});
  });
});

describe('resolveSystemFieldOverrides', () => {
  // The budget fragment carries `{amount, currency}` for every template shape.
  // `assembleProposalData` drops the currency on legacy `{type: 'number'}`
  // budgets (it hands AJV a bare number to range check), so renderers resolve
  // the fragment directly to keep the currency the author actually submitted.
  const legacyTemplate: ProposalTemplateSchema = {
    type: 'object',
    properties: {
      title: { type: 'string' },
      budget: { type: 'number', 'x-format': 'money', maximum: 10000 },
    },
  };

  it('keeps the fragment currency that the legacy assemble path drops', () => {
    const fragmentTexts = { budget: '{"amount":5000,"currency":"EUR"}' };

    // The validator payload is a bare number — no currency to render with.
    expect(assembleProposalData(legacyTemplate, fragmentTexts)).toEqual({
      budget: 5000,
    });
    expect(resolveSystemFieldOverrides(fragmentTexts).budget).toEqual({
      amount: 5000,
      currency: 'EUR',
    });
  });

  it('submits the same string-amount fragment it renders', () => {
    // The display parser and the validator payload have to agree on what a
    // fragment means. `normalizeBudget` alone rejects a string amount, which
    // put the raw JSON string in front of AJV on an object template ("budget
    // is invalid", with nothing on screen looking invalid) and silently
    // reduced the budget to 0 on a legacy `{type: 'number'}` one.
    const fragmentTexts = { budget: '{"amount":"5000","currency":"EUR"}' };

    expect(assembleProposalData(legacyTemplate, fragmentTexts)).toEqual({
      budget: 5000,
    });
    expect(
      assembleProposalData(
        {
          type: 'object',
          properties: {
            budget: {
              type: 'object',
              'x-format': 'money',
              properties: { currency: { type: 'string', default: 'GBP' } },
            },
          },
        },
        fragmentTexts,
      ),
    ).toEqual({ budget: { amount: 5000, currency: 'EUR' } });
  });

  it("assembles a currency-less fragment with the template's currency", () => {
    expect(
      assembleProposalData(
        {
          type: 'object',
          properties: {
            budget: {
              type: 'object',
              'x-format': 'money',
              properties: { currency: { type: 'string', default: 'GBP' } },
            },
          },
        },
        { budget: '{"amount":5000}' },
      ),
    ).toEqual({ budget: { amount: 5000, currency: 'GBP' } });
  });

  it('resolves a canonical object-shape fragment', () => {
    expect(
      resolveSystemFieldOverrides({
        budget: '{"amount":250,"currency":"GBP"}',
      }).budget,
    ).toEqual({ amount: 250, currency: 'GBP' });
  });

  it('defaults a bare numeric fragment to USD', () => {
    expect(resolveSystemFieldOverrides({ budget: '5000' }).budget).toEqual({
      amount: 5000,
      currency: 'USD',
    });
  });

  it('leaves the currency absent on a stored budget that named none', () => {
    // The invariant the whole fix rests on: a parsed budget must say honestly
    // whether the author chose a currency. Defaulting here makes the
    // fabrication indistinguishable from a real choice, so it outranks the
    // process's setting and the editor re-persists it.
    expect(parseProposalData({ budget: 5000 }).budget).toEqual({
      amount: 5000,
    });
    expect(parseProposalData({ budget: '5000' }).budget).toEqual({
      amount: 5000,
    });
    expect(parseProposalData({ budget: { amount: 5000 } }).budget).toEqual({
      amount: 5000,
    });
    expect(
      parseProposalData({ budget: { amount: 5000, currency: 'EUR' } }).budget,
    ).toEqual({ amount: 5000, currency: 'EUR' });
  });

  it('keeps the amount of a budget stored with a blank currency', () => {
    // A blank code must not take the amount down with it: the union would fall
    // through to the numeric branch, fail there too, and drop the budget.
    expect(
      parseProposalData({ budget: { amount: 5000, currency: '' } }).budget,
    ).toEqual({ amount: 5000, currency: '' });
  });

  it("gives a currency-less fragment the template's currency, not USD", () => {
    // A fragment that names no currency is denominated in the process's, not
    // the default, or a EUR process renders — and the editor re-persists — its
    // legacy fragments as dollars.
    expect(
      resolveSystemFieldOverrides({ budget: '5000' }, 'EUR').budget,
    ).toEqual({ amount: 5000, currency: 'EUR' });
  });

  it('treats a whitespace-only fragment currency as naming none', () => {
    // Parity with `getStoredBudgetCurrency`, which trims before deciding.
    // Passing '  ' through makes `Intl` throw, so the amount renders with no
    // currency marker at all rather than the process's.
    expect(
      resolveSystemFieldOverrides(
        { budget: '{"amount":5000,"currency":"  "}' },
        'EUR',
      ).budget,
    ).toEqual({ amount: 5000, currency: 'EUR' });
  });

  it('lets an explicit fragment currency win over the template default', () => {
    expect(
      resolveSystemFieldOverrides(
        { budget: '{"amount":5000,"currency":"GBP"}' },
        'EUR',
      ).budget,
    ).toEqual({ amount: 5000, currency: 'GBP' });
  });

  it('omits budget when the fragment is absent or unusable', () => {
    // Absent and unreadable both leave `proposalData` standing: an unreadable
    // fragment means we don't know the author's intent, and clearing the
    // budget deletes the fragment, so it lands here too. Whitespace-only is
    // unusable rather than zero — `Number('  ')` is `0`.
    for (const fragmentTexts of [
      {},
      { budget: '' },
      { budget: '   ' },
      { budget: '\n\t' },
      { budget: '5,000' },
      { budget: 'not a budget' },
      { budget: '{"currency":"EUR"}' },
      // A cleared-but-not-deleted amount is unknown, not zero — `Number('')`
      // and `Number('  ')` are both `0`.
      { budget: '{"amount":""}' },
      { budget: '{"amount":"  "}' },
    ]) {
      expect(resolveSystemFieldOverrides(fragmentTexts)).not.toHaveProperty(
        'budget',
      );
    }
  });

  it('reads object fragments that `moneyAmountSchema` would reject', () => {
    // Fragments are hand-written JSON in a collaborative document, so a string
    // amount and a missing currency both turn up. Rejecting them left the
    // editor pill showing "Add budget" for a budget the cards still rendered.
    expect(
      resolveSystemFieldOverrides(
        { budget: '{"amount":"5000","currency":"EUR"}' },
        'GBP',
      ).budget,
    ).toEqual({ amount: 5000, currency: 'EUR' });

    expect(
      resolveSystemFieldOverrides({ budget: '{"amount":5000}' }, 'GBP').budget,
    ).toEqual({ amount: 5000, currency: 'GBP' });
  });

  it('preserves a numeric-looking title exactly as the author typed it', () => {
    // Legacy templates without `x-format` run titles through `JSON.parse`, so
    // resolving via `assembleProposalData` would rewrite these.
    expect(assembleProposalData(legacyTemplate, { title: '2024.10' })).toEqual({
      title: 2024.1,
    });

    for (const title of ['2024.10', '1e3', '12345678901234567890']) {
      expect(resolveSystemFieldOverrides({ title }).title).toBe(title);
    }
  });

  it('omits an empty or whitespace-only title', () => {
    expect(resolveSystemFieldOverrides({})).not.toHaveProperty('title');
    expect(resolveSystemFieldOverrides({ title: '   ' })).not.toHaveProperty(
      'title',
    );
  });
});

describe('stored budget parsing', () => {
  it('keeps a string amount and the currency stored beside it', () => {
    // Imported and hand-written rows carry `{"amount":"5000"}`. Rejecting the
    // shape dropped the whole budget: the amount vanished from every surface,
    // and the currency went with it, so the template's won a budget that had
    // named its own.
    expect(normalizeBudget({ amount: '5000', currency: 'EUR' })).toEqual({
      amount: 5000,
      currency: 'EUR',
    });
  });

  it('leaves the currency absent when the stored budget names none', () => {
    expect(normalizeBudget({ amount: 5000 })).toEqual({ amount: 5000 });
    expect(normalizeBudget(5000)).toEqual({ amount: 5000 });
  });
});

describe('parseStoredBudgetFragmentValue', () => {
  it('leaves the currency absent for a fragment that names none', () => {
    // What the editor writes back. Resolving the fallback in here would
    // autosave it onto the row, pinning the proposal to whichever currency
    // happened to be resolved the first time someone opened it.
    expect(parseStoredBudgetFragmentValue('{"amount":5000}')).toEqual({
      amount: 5000,
    });
    expect(parseStoredBudgetFragmentValue('5000')).toEqual({ amount: 5000 });
    expect(
      parseStoredBudgetFragmentValue('{"amount":5000,"currency":"  "}'),
    ).toEqual({ amount: 5000 });
  });

  it('keeps a currency the fragment does name', () => {
    expect(
      parseStoredBudgetFragmentValue('{"amount":5000,"currency":"EUR"}'),
    ).toEqual({ amount: 5000, currency: 'EUR' });
  });

  it('reads nothing usable as undefined', () => {
    for (const text of ['', '   ', '{"amount":""}', 'no budget here']) {
      expect(parseStoredBudgetFragmentValue(text)).toBeUndefined();
    }
  });
});

describe('withStoredBudgetCurrency', () => {
  it('carries a stored currency onto a budget that names none', () => {
    // The fragment names a currency only when whoever wrote it filled one in,
    // so an amount edit on a legacy fragment would otherwise persist
    // `{amount}` over a row that had named EUR — deleting the code, and
    // dropping the proposal to the process's currency on every surface.
    expect(withStoredBudgetCurrency({ amount: 6000 }, 'EUR')).toEqual({
      amount: 6000,
      currency: 'EUR',
    });
  });

  it('keeps the currency the new budget names', () => {
    expect(
      withStoredBudgetCurrency({ amount: 6000, currency: 'GBP' }, 'EUR'),
    ).toEqual({ amount: 6000, currency: 'GBP' });
  });

  it('names none when nothing is stored to carry', () => {
    // Not stamping: only a currency already chosen and stored travels, never
    // one resolved from the template or the default.
    expect(withStoredBudgetCurrency({ amount: 6000 }, undefined)).toEqual({
      amount: 6000,
    });
    expect(withStoredBudgetCurrency({ amount: 6000 }, '  ')).toEqual({
      amount: 6000,
    });
  });

  it('leaves an absent budget absent', () => {
    expect(withStoredBudgetCurrency(undefined, 'EUR')).toBeUndefined();
  });
});

describe('toValidationBudget', () => {
  // AJV runs with `coerceTypes: false`, so a legacy template that declares
  // `{type: 'number'}` rejects the canonical object outright — the author saw
  // "Budget is invalid" and could not submit at all.
  it('hands a legacy number template the bare amount', () => {
    expect(
      toValidationBudget(
        { type: 'number', 'x-format': 'money', maximum: 10000 },
        { amount: 5000, currency: 'EUR' },
      ),
    ).toBe(5000);
  });

  it('hands a canonical object template the whole budget', () => {
    expect(
      toValidationBudget(
        { type: 'object', 'x-format': 'money' },
        { amount: 5000, currency: 'EUR' },
      ),
    ).toEqual({ amount: 5000, currency: 'EUR' });
  });
});

describe('assembleProposalData money fields', () => {
  const legacyMoneyTemplate: ProposalTemplateSchema = {
    type: 'object',
    properties: {
      budget: { type: 'number', 'x-format': 'money', maximum: 10000 },
    },
  };

  it('drops a whitespace-only budget fragment rather than failing on it', () => {
    // Absent, not invalid: handing AJV `'   '` blocks submission on a template
    // that leaves the budget optional, and reports "invalid" rather than
    // "required" on one that doesn't.
    expect(
      assembleProposalData(legacyMoneyTemplate, { budget: '   ' }),
    ).toEqual({});
  });
});
