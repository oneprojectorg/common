import { afterEach, describe, expect, it, vi } from 'vitest';

import { RealtimeClient } from './client';

const res = (status: number, detail = '') => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: `status ${status}`,
  json: async () => ({}),
  text: async () => detail,
  body: { cancel: vi.fn() },
});

const newClient = () =>
  new RealtimeClient({
    supabaseUrl: 'https://example.supabase.co',
    serviceRoleKey: 'service-role-key',
  });

const publish = () =>
  newClient().publish({ channel: 'org:1', data: { mutationId: 'm1' } });

afterEach(() => vi.unstubAllGlobals());

describe('RealtimeClient.publish', () => {
  it('posts a single-topic messages array to the broadcast endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200));
    vi.stubGlobal('fetch', fetchMock);

    await publish();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0]![0];
    const init = fetchMock.mock.calls[0]![1];
    expect(url).toBe('https://example.supabase.co/realtime/v1/api/broadcast');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      messages: [
        {
          topic: 'org:1',
          event: 'invalidation',
          payload: { mutationId: 'm1' },
        },
      ],
    });
  });

  it('releases the response body instead of pinning the socket', async () => {
    const response = res(200);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    await publish();

    expect(response.body.cancel).toHaveBeenCalled();
  });

  it('does not retry a 429 — the backoff lands inside the same window', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(429));
    vi.stubGlobal('fetch', fetchMock);

    const error = await publish().catch((e) => e);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(error).toBeInstanceOf(Error);
  });

  it('does not retry 501 / 505, which never heal', async () => {
    for (const status of [501, 505]) {
      const fetchMock = vi.fn().mockResolvedValue(res(status));
      vi.stubGlobal('fetch', fetchMock);

      await publish().catch(() => {});

      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  });

  it("surfaces the server's rejection reason in the error", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(res(400, 'invalid topic name')),
    );

    const error = await publish().catch((e) => e);

    expect(error.message).toContain('400');
    expect(error.message).toContain('invalid topic name');
  });

  it('retries once on 5xx then returns on success', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(503))
      .mockResolvedValueOnce(res(200));
    vi.stubGlobal('fetch', fetchMock);

    await publish();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry on a non-retryable 4xx and throws', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(403));
    vi.stubGlobal('fetch', fetchMock);

    const error = await publish().catch((e) => e);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(error).toBeInstanceOf(Error);
  });

  it('throws after the retry budget is exhausted on persistent 5xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(503));
    vi.stubGlobal('fetch', fetchMock);

    const error = await publish().catch((e) => e);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(error).toBeInstanceOf(Error);
  });

  it('retries a network-level failure, not just a bad status', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce(res(200));
    vi.stubGlobal('fetch', fetchMock);

    await publish();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses a fresh AbortSignal per attempt', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(503))
      .mockResolvedValueOnce(res(200));
    vi.stubGlobal('fetch', fetchMock);

    await publish();

    const firstSignal = fetchMock.mock.calls[0]![1].signal;
    const secondSignal = fetchMock.mock.calls[1]![1].signal;
    expect(firstSignal).toBeInstanceOf(AbortSignal);
    expect(secondSignal).toBeInstanceOf(AbortSignal);
    // A signal reused across attempts would already be aborted by the time the
    // retry fires, so the retry could never succeed.
    expect(firstSignal).not.toBe(secondSignal);
  });
});
