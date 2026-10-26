import { describe, expect, it } from 'vitest';

import { encodeErrorDigest, parseErrorDigest } from './errorDigest';

describe('error digest', () => {
  it('round-trips the status and the error name', () => {
    // Given a 403 from an UnauthorizedError
    const digest = encodeErrorDigest({
      statusCode: 403,
      name: 'UnauthorizedError',
    });

    // When the client decodes the digest
    const parsed = parseErrorDigest(digest);

    // Then it reads the same status and name back
    expect(parsed).toEqual({ statusCode: 403, name: 'UnauthorizedError' });
  });

  it('returns null for a digest Next.js generated, or none', () => {
    // Given the hash Next.js writes for an ordinary error, and no digest
    // When the client decodes them
    // Then neither decodes to HTTP semantics
    expect(parseErrorDigest('2732305804')).toBeNull();
    expect(parseErrorDigest(undefined)).toBeNull();
    expect(parseErrorDigest('COMMON_ERROR;abc;UnauthorizedError')).toBeNull();
  });
});
