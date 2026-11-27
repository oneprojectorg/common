import { describe, expect, it } from 'vitest';

import { isChunkLoadError } from './chunkLoadError';

const namedError = (name: string, message: string) => {
  const error = new Error(message);
  error.name = name;
  return error;
};

describe('isChunkLoadError', () => {
  it('matches a webpack ChunkLoadError', () => {
    expect(
      isChunkLoadError(
        namedError(
          'ChunkLoadError',
          'Loading chunk 1968 failed.\n(timeout: https://example.com/_next/static/chunks/1968.js)',
        ),
      ),
    ).toBe(true);
  });

  it('matches a chunk failure by its message', () => {
    expect(isChunkLoadError(new Error('Loading chunk 7556 failed.'))).toBe(
      true,
    );
    expect(isChunkLoadError(new Error('Loading CSS chunk 12 failed.'))).toBe(
      true,
    );
    expect(
      isChunkLoadError(
        new Error('Failed to load chunk /_next/static/chunks/abc.js'),
      ),
    ).toBe(true);
  });

  it('does not match other errors', () => {
    expect(isChunkLoadError(new TypeError('provider.register failed'))).toBe(
      false,
    );
    expect(isChunkLoadError('Loading chunk 1 failed.')).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});
