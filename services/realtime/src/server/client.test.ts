import { afterEach, describe, expect, it, vi } from 'vitest';

import { RealtimeClient } from './client';

const res = (status: number) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: `status ${status}`,
  json: async () => ({}),
});

const newClient = () =>
  new RealtimeClient({
    supabaseUrl: 'https://example.supabase.co',
    serviceRoleKey: 'service-role-key',
  });

afterEach(() => vi.unstubAllGlobals());

describe('RealtimeClient.publishMany', () => {
  it('posts one request with all topics in a single messages array', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200));
    vi.stubGlobal('fetch', fetchMock);

    await newClient().publishMany({
      messages: [
        { channel: 'org:1', data: { mutationId: 'm1' } },
        { channel: 'user:42', data: { mutationId: 'm1' } },
      ],
    });

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
        {
          topic: 'user:42',
          event: 'invalidation',
          payload: { mutationId: 'm1' },
        },
      ],
    });
  });

  it('is a no-op for an empty messages array', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200));
    vi.stubGlobal('fetch', fetchMock);

    await newClient().publishMany({ messages: [] });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retries once on 429 then returns on success', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(429))
      .mockResolvedValueOnce(res(200));
    vi.stubGlobal('fetch', fetchMock);

    await newClient().publishMany({
      messages: [{ channel: 'org:1', data: { mutationId: 'm1' } }],
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries once on 5xx then returns on success', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(503))
      .mockResolvedValueOnce(res(200));
    vi.stubGlobal('fetch', fetchMock);

    await newClient().publishMany({
      messages: [{ channel: 'org:1', data: { mutationId: 'm1' } }],
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry on a non-retryable 4xx and throws', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(403));
    vi.stubGlobal('fetch', fetchMock);

    const error = await newClient()
      .publishMany({
        messages: [{ channel: 'org:1', data: { mutationId: 'm1' } }],
      })
      .catch((e) => e);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(error).toBeInstanceOf(Error);
  });

  it('throws after the retry budget is exhausted on persistent 5xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(503));
    vi.stubGlobal('fetch', fetchMock);

    const error = await newClient()
      .publishMany({
        messages: [{ channel: 'org:1', data: { mutationId: 'm1' } }],
      })
      .catch((e) => e);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(error).toBeInstanceOf(Error);
  });

  it('uses a fresh AbortSignal per attempt', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(503))
      .mockResolvedValueOnce(res(200));
    vi.stubGlobal('fetch', fetchMock);

    await newClient().publishMany({
      messages: [{ channel: 'org:1', data: { mutationId: 'm1' } }],
    });

    const firstSignal = fetchMock.mock.calls[0]![1].signal;
    const secondSignal = fetchMock.mock.calls[1]![1].signal;
    expect(firstSignal).toBeInstanceOf(AbortSignal);
    expect(secondSignal).toBeInstanceOf(AbortSignal);
    expect(firstSignal).not.toBe(secondSignal);
  });
});

describe('RealtimeClient.publish (single)', () => {
  it('routes through publishMany with the same body shape', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200));
    vi.stubGlobal('fetch', fetchMock);

    await newClient().publish({
      channel: 'org:1',
      data: { mutationId: 'm1' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({
      messages: [
        {
          topic: 'org:1',
          event: 'invalidation',
          payload: { mutationId: 'm1' },
        },
      ],
    });
  });
});
