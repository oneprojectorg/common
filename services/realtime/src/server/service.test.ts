import { Channels } from '@op/common/realtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const counterAdd = vi.fn();
const loggerError = vi.fn();

vi.mock('@op/logging', () => ({
  logger: {
    error: (...args: unknown[]) => loggerError(...args),
    info: vi.fn(),
    warn: vi.fn(),
  },
  metrics: {
    getMeter: () => ({ createCounter: () => ({ add: counterAdd }) }),
  },
}));

const { realtime } = await import('./service');

const res = (status: number) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: `status ${status}`,
});

/** Topics of the single request the mock received, in send order. */
const sentTopics = (fetchMock: ReturnType<typeof vi.fn>): string[] => {
  const call = fetchMock.mock.calls[0];
  if (!call) {
    throw new Error('fetch was never called');
  }
  const { messages } = JSON.parse(call[1].body);
  return messages.map((m: { topic: string }) => m.topic);
};

/** The context object of the single `logger.error` the mock received. */
const loggedContext = (): Record<string, unknown> => {
  const call = loggerError.mock.calls[0];
  if (!call) {
    throw new Error('logger.error was never called');
  }
  return call[1];
};

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE = 'service-role-key';
  counterAdd.mockClear();
  loggerError.mockClear();
});

afterEach(() => vi.unstubAllGlobals());

describe('RealtimeService.publishMany', () => {
  it('deduplicates channels into one message per unique topic', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200));
    vi.stubGlobal('fetch', fetchMock);

    await realtime.publishMany(['org:1', 'user:42', 'org:1'], {
      mutationId: 'm1',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentTopics(fetchMock)).toEqual(['org:1', 'user:42']);
  });

  it('is a no-op on an empty channel list', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200));
    vi.stubGlobal('fetch', fetchMock);

    await realtime.publishMany([], { mutationId: 'm1' });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(loggerError).not.toHaveBeenCalled();
    expect(counterAdd).not.toHaveBeenCalled();
  });

  it('is a no-op when every channel is a duplicate of nothing', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200));
    vi.stubGlobal('fetch', fetchMock);

    await realtime.publishMany(['org:1', 'org:1', 'org:1'], {
      mutationId: 'm1',
    });

    expect(sentTopics(fetchMock)).toEqual(['org:1']);
  });

  it('swallows a publish failure rather than rejecting the caller', async () => {
    // 400 is non-retryable, so this resolves without a backoff sleep.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(400)));

    await expect(
      realtime.publishMany(['org:1'], { mutationId: 'm1' }),
    ).resolves.toBeUndefined();
  });

  it('counts a failure with a bucketed topic attribute, never a raw count', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(400)));

    await realtime.publishMany(['org:1'], { mutationId: 'm1' });

    expect(counterAdd).toHaveBeenCalledWith(1, { topics: '1' });
  });

  it('logs the failing channel names and the Error itself', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(400)));

    await realtime.publishMany(['org:1', 'user:42'], { mutationId: 'm1' });

    expect(loggerError).toHaveBeenCalledTimes(1);
    expect(loggerError.mock.calls[0]?.[0]).toBe(
      '[Realtime] publishMany failed',
    );
    const context = loggedContext();
    expect(context.channels).toEqual(['org:1', 'user:42']);
    expect(context.topics).toBe(2);
    // The Error is passed through, not stringified — the stack must survive.
    expect(context.error).toBeInstanceOf(Error);
  });

  it('caps how many channel names reach the log line', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(400)));

    const channels = Array.from({ length: 25 }, (_, i) => Channels.org(`${i}`));
    await realtime.publishMany(channels, { mutationId: 'm1' });

    expect(loggedContext().channels).toHaveLength(10);
    expect(counterAdd).toHaveBeenCalledWith(1, { topics: '11-100' });
  });
});

describe('RealtimeService.publish', () => {
  it('delegates to publishMany with a single topic', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200));
    vi.stubGlobal('fetch', fetchMock);

    await realtime.publish('org:1', { mutationId: 'm1' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentTopics(fetchMock)).toEqual(['org:1']);
  });
});
