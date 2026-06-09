import { afterEach, describe, expect, it, vi } from 'vitest';

import { withRetry } from './retry';

afterEach(() => vi.restoreAllMocks());

describe('withRetry', () => {
  it('returns the result once fn succeeds, after retrying earlier throws', async () => {
    const fn = vi
      .fn<(attempt: number) => Promise<string>>()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce('ok');

    const result = await withRetry(fn, { retries: 2, minDelayMs: 0 });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('stops after retries + 1 attempts and rethrows the last error', async () => {
    const fn = vi
      .fn<(attempt: number) => Promise<never>>()
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'))
      .mockRejectedValue(new Error('last'));

    const error = await withRetry(fn, { retries: 1, minDelayMs: 0 }).catch(
      (e) => e,
    );

    // retries: 1 → at most 2 attempts; the 2nd attempt's error is surfaced.
    expect(fn).toHaveBeenCalledTimes(2);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('second');
  });

  it('does not retry when shouldRetry returns false', async () => {
    const fn = vi
      .fn<(attempt: number) => Promise<never>>()
      .mockRejectedValue(new Error('fatal'));

    const error = await withRetry(fn, {
      retries: 5,
      minDelayMs: 0,
      shouldRetry: () => false,
    }).catch((e) => e);

    expect(fn).toHaveBeenCalledTimes(1);
    expect((error as Error).message).toBe('fatal');
  });

  it('passes the zero-based attempt number to fn', async () => {
    const attempts: number[] = [];
    const fn = vi.fn(async (attempt: number) => {
      attempts.push(attempt);
      if (attempt < 2) {
        throw new Error('retry');
      }
      return 'done';
    });

    await withRetry(fn, { retries: 3, minDelayMs: 0 });

    expect(attempts).toEqual([0, 1, 2]);
  });

  it('keeps the jitter delay within [0, ceiling] and caps the ceiling at maxDelayMs', async () => {
    const delays: number[] = [];
    // Math.random = 1 makes the full-jitter delay equal to the whole ceiling,
    // so we can assert the ceiling growth/cap deterministically.
    vi.spyOn(Math, 'random').mockReturnValue(1);

    const fn = vi
      .fn<(attempt: number) => Promise<never>>()
      .mockRejectedValue(new Error('always'));

    await withRetry(fn, {
      retries: 3,
      minDelayMs: 100,
      factor: 10,
      maxDelayMs: 250,
      onRetry: (_error, _attempt, delayMs) => delays.push(delayMs),
    }).catch(() => undefined);

    // attempt 0: min(250, 100*10^0)=100; attempt 1: min(250, 100*10^1)=250 (capped);
    // attempt 2: min(250, 100*10^2)=250 (capped).
    expect(delays).toEqual([100, 250, 250]);
  });

  it('uses a near-zero delay at the low end of full jitter', async () => {
    const delays: number[] = [];
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const fn = vi
      .fn<(attempt: number) => Promise<never>>()
      .mockRejectedValue(new Error('always'));

    await withRetry(fn, {
      retries: 2,
      minDelayMs: 200,
      onRetry: (_error, _attempt, delayMs) => delays.push(delayMs),
    }).catch(() => undefined);

    expect(delays).toEqual([0, 0]);
  });
});
