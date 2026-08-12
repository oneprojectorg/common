import { describe, expect, it } from 'vitest';

import {
  assembleProposalData,
  resolveSystemFieldOverrides,
} from './assembleProposalData';
import {
  isDistrictCategoryLabel,
  normalizeLocation,
  normalizeProposalCategories,
  parseProposalData,
  parseSchemaOptions,
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

  it("gives a currency-less fragment the template's currency, not USD", () => {
    // `budgetValueSchema` stamps USD onto legacy shapes. That default must lose
    // to the process's configured currency, or a EUR process renders — and the
    // editor re-persists — its legacy fragments as dollars.
    expect(
      resolveSystemFieldOverrides({ budget: '5000' }, 'EUR').budget,
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
