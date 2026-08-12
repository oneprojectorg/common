import { Channels } from '@op/common/realtime';
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

const manyMessages = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    channel: Channels.org(`${i}`),
    data: { mutationId: 'm1' },
  }));

/** How many topics the nth request carried. */
const topicCountOf = (
  fetchMock: ReturnType<typeof vi.fn>,
  index: number,
): number => {
  const call = fetchMock.mock.calls[index];
  if (!call) {
    throw new Error(`fetch was not called ${index + 1} time(s)`);
  }
  return JSON.parse(call[1].body).messages.length;
};

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

  it('does not retry a 429 — the backoff lands inside the same window', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(429));
    vi.stubGlobal('fetch', fetchMock);

    const error = await newClient()
      .publishMany({
        messages: [{ channel: 'org:1', data: { mutationId: 'm1' } }],
      })
      .catch((e) => e);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(error).toBeInstanceOf(Error);
  });

  it('does not retry 501 / 505, which never heal', async () => {
    for (const status of [501, 505]) {
      const fetchMock = vi.fn().mockResolvedValue(res(status));
      vi.stubGlobal('fetch', fetchMock);

      await newClient()
        .publishMany({
          messages: [{ channel: 'org:1', data: { mutationId: 'm1' } }],
        })
        .catch(() => {});

      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  });

  it("surfaces the server's rejection reason in the error", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(res(400, 'invalid topic name')),
    );

    const error = await newClient()
      .publishMany({
        messages: [{ channel: 'org:1', data: { mutationId: 'm1' } }],
      })
      .catch((e) => e);

    expect(error.message).toContain('400');
    expect(error.message).toContain('invalid topic name');
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

  it('splits a wide fan-out into chunks of 100', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200));
    vi.stubGlobal('fetch', fetchMock);

    await newClient().publishMany({ messages: manyMessages(250) });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(topicCountOf(fetchMock, 0)).toBe(100);
    expect(topicCountOf(fetchMock, 1)).toBe(100);
    expect(topicCountOf(fetchMock, 2)).toBe(50);
  });

  it('sends a single request when the fan-out fits in one chunk', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200));
    vi.stubGlobal('fetch', fetchMock);

    await newClient().publishMany({ messages: manyMessages(100) });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('still delivers the surviving chunks when one chunk fails', async () => {
    // First chunk is rejected outright (non-retryable); the rest must go out.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(400))
      .mockResolvedValue(res(200));
    vi.stubGlobal('fetch', fetchMock);

    const error = await newClient()
      .publishMany({ messages: manyMessages(250) })
      .catch((e) => e);

    // All three chunks were attempted, not short-circuited by the first.
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain('1 of 3 chunk(s)');
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
