import { describe, expect, it } from 'vitest';

import { assembleProposalData } from './assembleProposalData';
import { proposalLocationToGeometry } from './locationGeometry';
import {
  normalizeLocation,
  normalizeProposalCategories,
  parseProposalData,
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

describe('proposalLocationToGeometry', () => {
  it('projects lat/lng into x/y (lng first)', () => {
    expect(
      proposalLocationToGeometry({ location: { lat: 40.7, lng: -74 } }),
    ).toEqual({ x: -74, y: 40.7 });
  });

  it('returns null when location is absent', () => {
    expect(proposalLocationToGeometry({ title: 'No location' })).toBeNull();
    expect(proposalLocationToGeometry(undefined)).toBeNull();
    expect(proposalLocationToGeometry(null)).toBeNull();
  });

  it('returns null for malformed locations without throwing', () => {
    expect(proposalLocationToGeometry({ location: 'oops' })).toBeNull();
    expect(
      proposalLocationToGeometry({ location: { lat: 999, lng: 0 } }),
    ).toBeNull();
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
