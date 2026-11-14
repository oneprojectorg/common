import { describe, expect, it } from 'vitest';

import { encodeErrorDigest, parseErrorDigest } from './errorDigest';

describe('error digest', () => {
  it('round-trips the status and the error name', () => {
    const digest = encodeErrorDigest({
      statusCode: 403,
      name: 'UnauthorizedError',
    });

    const parsed = parseErrorDigest(digest);

    expect(parsed).toEqual({ statusCode: 403, name: 'UnauthorizedError' });
  });

  it('returns null for a digest Next.js generated, or none', () => {
    expect(parseErrorDigest('2732305804')).toBeNull();
    expect(parseErrorDigest(undefined)).toBeNull();
    expect(parseErrorDigest('COMMON_ERROR;abc;UnauthorizedError')).toBeNull();
  });
});
