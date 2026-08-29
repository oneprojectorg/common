import { describe, expect, it } from 'vitest';

import {
  extractProposalIds,
  summarizeProposalIdImport,
} from './proposalIdImport';

const A = '550e8400-e29b-41d4-a716-446655440000';
const B = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const C = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';

describe('extractProposalIds', () => {
  it('reads a single pasted column', () => {
    expect(extractProposalIds(`${A}\n${B}\n`)).toEqual([A, B]);
  });

  it('ignores everything that is not UUID-shaped', () => {
    const sheet = [
      'Proposal ID\tTitle\tDepartment',
      `${A}\t"Bike lanes, phase 2"\tTransport`,
      `${B}\tPark benches\tParks`,
    ].join('\n');

    expect(extractProposalIds(sheet)).toEqual([A, B]);
  });

  it('reads comma-delimited text the same as tab-delimited', () => {
    expect(extractProposalIds(`${A},${B}\n${C}\t${A}`)).toEqual([A, B, C]);
  });

  it('lower-cases and de-duplicates', () => {
    expect(extractProposalIds(`${A.toUpperCase()}, ${A}`)).toEqual([A]);
  });

  it('finds IDs inside pasted proposal URLs', () => {
    expect(extractProposalIds(`https://app.example.org/proposal/${A}`)).toEqual(
      [A],
    );
  });

  it('rejects UUID-shaped tokens with invalid version bits', () => {
    // z.uuid() checks the RFC 9562 version/variant nibbles, not just the shape.
    expect(extractProposalIds('550e8400-e29b-01d4-c716-446655440000')).toEqual(
      [],
    );
  });

  it('returns nothing for text with no IDs', () => {
    expect(extractProposalIds('no ids here, 1234-56')).toEqual([]);
  });
});

describe('summarizeProposalIdImport', () => {
  it('splits a paste into matched, not found and skipped', () => {
    const summary = summarizeProposalIdImport({
      pastedText: `${A}\n${B}\n${C}`,
      poolIds: new Set([A, B]),
      assignableIds: new Set([A]),
    });

    expect(summary).toEqual({
      matchedIds: [A],
      // B is in the phase but blocked for this reviewer.
      skippedCount: 1,
      // C is not a proposal in this phase.
      notFoundCount: 1,
    });
  });
});
