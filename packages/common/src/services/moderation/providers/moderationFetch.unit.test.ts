import { afterEach, describe, expect, it, vi } from 'vitest';

import { moderationFetch } from './moderationFetch';

const res = (status: number) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => ({}),
});

const init = { method: 'POST', headers: {}, body: '{}' } as const;

afterEach(() => vi.unstubAllGlobals());

describe('moderationFetch', () => {
  it('retries a 429 and returns the eventual success', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(429))
      .mockResolvedValueOnce(res(200));
    vi.stubGlobal('fetch', fetchMock);

    const response = await moderationFetch('https://x', init);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries a 5xx and returns the eventual success', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(503))
      .mockResolvedValueOnce(res(200));
    vi.stubGlobal('fetch', fetchMock);

    const response = await moderationFetch('https://x', init);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns a non-retryable 4xx to the caller without retrying', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(403));
    vi.stubGlobal('fetch', fetchMock);

    const response = await moderationFetch('https://x', init);

    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a thrown network/timeout error then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(res(200));
    vi.stubGlobal('fetch', fetchMock);

    const response = await moderationFetch('https://x', init);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('creates a fresh AbortSignal for each attempt', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(res(200));
    vi.stubGlobal('fetch', fetchMock);

    await moderationFetch('https://x', init);

    const firstSignal = fetchMock.mock.calls[0][1].signal;
    const secondSignal = fetchMock.mock.calls[1][1].signal;
    expect(firstSignal).toBeInstanceOf(AbortSignal);
    expect(secondSignal).toBeInstanceOf(AbortSignal);
    expect(firstSignal).not.toBe(secondSignal);
  });

  it('honors a tighter retry budget via the retries option', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(503));
    vi.stubGlobal('fetch', fetchMock);

    const error = await moderationFetch('https://x', init, { retries: 1 })
      .then(() => null)
      .catch((e) => e);

    // 1 retry → 2 attempts, then the retryable error throws.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(error).toBeInstanceOf(Error);
    expect(String((error as Error).message)).not.toContain('https://x');
  });
});
