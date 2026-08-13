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
  text: async () => '',
  body: { cancel: vi.fn() },
});

/**
 * The topic each request carried, in call order. One topic per request now —
 * fan-out is a request per channel, not a multi-topic batch.
 */
const sentTopics = (fetchMock: ReturnType<typeof vi.fn>): string[] =>
  fetchMock.mock.calls.map((call) => {
    const { messages } = JSON.parse(call[1].body);
    if (messages.length !== 1) {
      throw new Error(`expected 1 topic per request, got ${messages.length}`);
    }
    return messages[0].topic;
  });

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
  it('deduplicates channels into one request per unique topic', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200));
    vi.stubGlobal('fetch', fetchMock);

    await realtime.publishMany(['org:1', 'user:42', 'org:1'], {
      mutationId: 'm1',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
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

  it('collapses a list of all-duplicate channels to one request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200));
    vi.stubGlobal('fetch', fetchMock);

    await realtime.publishMany(['org:1', 'org:1', 'org:1'], {
      mutationId: 'm1',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentTopics(fetchMock)).toEqual(['org:1']);
  });

  it('swallows a publish failure rather than rejecting the caller', async () => {
    // 400 is non-retryable, so this resolves without a backoff sleep.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(400)));

    await expect(
      realtime.publishMany(['org:1'], { mutationId: 'm1' }),
    ).resolves.toBeUndefined();
  });

  it('still publishes the surviving channels when one channel fails', async () => {
    // First channel is rejected outright; the second must still go out.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(400))
      .mockResolvedValue(res(200));
    vi.stubGlobal('fetch', fetchMock);

    await realtime.publishMany(['org:1', 'user:42'], { mutationId: 'm1' });

    expect(sentTopics(fetchMock)).toEqual(['org:1', 'user:42']);
    // Only the failing channel is counted and named.
    expect(counterAdd).toHaveBeenCalledWith(1);
    expect(loggedContext().channels).toEqual(['org:1']);
  });

  it('counts one failure per failed channel, with no metric attributes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(400)));

    await realtime.publishMany(['org:1', 'user:42'], { mutationId: 'm1' });

    // Unbounded fan-out size can never be a metric attribute — counting failed
    // channels instead of failed calls removes the need for one.
    expect(counterAdd).toHaveBeenCalledWith(2);
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
    expect(context.failed).toBe(2);
    // The Error is passed through, not stringified — the stack must survive.
    expect(context.error).toBeInstanceOf(Error);
  });

  it('caps how many channel names reach the log line', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(400)));

    const channels = Array.from({ length: 25 }, (_, i) => Channels.org(`${i}`));
    await realtime.publishMany(channels, { mutationId: 'm1' });

    expect(loggedContext().channels).toHaveLength(10);
    expect(loggedContext().failed).toBe(25);
    expect(counterAdd).toHaveBeenCalledWith(25);
  });

  it('does not log or count anything when every channel succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(200)));

    await realtime.publishMany(['org:1', 'user:42'], { mutationId: 'm1' });

    expect(loggerError).not.toHaveBeenCalled();
    expect(counterAdd).not.toHaveBeenCalled();
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
