import { describe, expect, it } from 'vitest';

import { assembleProposalData } from './assembleProposalData';
import {
  getPlaceCoordinates,
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

describe('getPlaceCoordinates', () => {
  it('prefers the geocoded place over the submitted pin', () => {
    expect(
      getPlaceCoordinates({
        lat: 39.9612,
        lng: -82.9988,
        placeLat: 39.9,
        placeLng: -83.0,
      }),
    ).toEqual({ lat: 39.9, lng: -83.0 });
  });

  // The geocoder returns no match for a pin in open water, or anywhere its
  // lookup misses, and `placeLat`/`placeLng` stay unset. Returning nothing here
  // would drop those proposals off a map export entirely, so the pin stands in.
  it('falls back to the pin when no place was geocoded', () => {
    expect(getPlaceCoordinates({ lat: 39.9612, lng: -82.9988 })).toEqual({
      lat: 39.9612,
      lng: -82.9988,
    });
  });

  // Guards `??` against `||`: a proposal on the equator or the prime meridian
  // has a legitimate 0 that must not be mistaken for an absent coordinate.
  it('treats a zero place coordinate as present', () => {
    expect(
      getPlaceCoordinates({ lat: 12, lng: 34, placeLat: 0, placeLng: 0 }),
    ).toEqual({ lat: 0, lng: 0 });
  });
});
