import type { AppRouter } from '@op/api';
import { TRPCClientError, isNetworkError } from '@op/api/clientErrors';
import { describe, expect, it } from 'vitest';

function trpcError(message: string, data?: { httpStatus?: number }) {
  return TRPCClientError.from<AppRouter>({
    error: { code: -32001, message, data },
  });
}

describe('isNetworkError', () => {
  it('is true for a browser fetch TypeError (Chrome / Safari / Firefox)', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkError(new TypeError('Load failed'))).toBe(true);
    expect(
      isNetworkError(
        new TypeError('NetworkError when attempting to fetch resource.'),
      ),
    ).toBe(true);
  });

  it('is true for a tRPC error with no status and a network message', () => {
    expect(isNetworkError(trpcError('Failed to fetch'))).toBe(true);
  });

  it('is false when the error carries an HTTP status', () => {
    expect(
      isNetworkError(trpcError('Failed to fetch', { httpStatus: 500 })),
    ).toBe(false);
  });

  it('is false for an unrelated TypeError', () => {
    expect(isNetworkError(new TypeError('x is not a function'))).toBe(false);
  });

  it('is false for a non-tRPC, non-TypeError error', () => {
    expect(isNetworkError(new Error('Failed to fetch'))).toBe(false);
  });
});
