import { describe, expect, it } from 'vitest';

import { hashAttestation } from './attestationHash';

describe('hashAttestation', () => {
  it('given the attestation text, then the hash is the SHA-256 of that text in hex', () => {
    expect(hashAttestation('I affirm.')).toBe(
      '6bfe9193f0b1a8b0e9ca1dc2341aede0d4fad648844d2403eba5a5fa5ebc6edb',
    );
  });

  it('given the same text twice, then the hashes are equal, and a one-character change gives a different hash', () => {
    expect(hashAttestation('I affirm.')).toBe(hashAttestation('I affirm.'));
    expect(hashAttestation('I affirm.')).not.toBe(hashAttestation('I affirm!'));
  });
});
