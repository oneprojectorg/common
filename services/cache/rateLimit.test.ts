import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Same approach as `kv.test.ts`: stub the redis package at module-scope so
// the sliding-window code under test sees our fake client.
type Reply = number | { score: number; value: string }[] | string | undefined;

type FakeMulti = {
  zRemRangeByScore: Mock;
  zAdd: Mock;
  zCard: Mock;
  pExpire: Mock;
  zRangeWithScores: Mock;
  exec: Mock<() => Promise<Reply[]>>;
};

type ScopedMulti = {
  zRemRangeByScore: Mock;
  zAdd: Mock;
  zCard: Mock;
  pExpire: Mock;
  zRangeWithScores: Mock;
  exec: () => Promise<Reply[]>;
};

type FakeClient = {
  isOpen: boolean;
  on: Mock;
  connect: Mock;
  withAbortSignal: (signal: AbortSignal) => { multi: () => ScopedMulti };
};

const fakeMulti: FakeMulti = {
  zRemRangeByScore: vi.fn().mockReturnThis(),
  zAdd: vi.fn().mockReturnThis(),
  zCard: vi.fn().mockReturnThis(),
  pExpire: vi.fn().mockReturnThis(),
  zRangeWithScores: vi.fn().mockReturnThis(),
  exec: vi.fn<() => Promise<Reply[]>>(),
};

const fakeClient: FakeClient = {
  isOpen: true,
  on: vi.fn(),
  connect: vi.fn(),
  withAbortSignal: (signal: AbortSignal) => ({
    multi: () => ({
      ...fakeMulti,
      exec: () => {
        if (signal.aborted) {
          return Promise.reject(
            Object.assign(new Error('aborted'), { name: 'AbortError' }),
          );
        }
        return fakeMulti.exec();
      },
    }),
  }),
};

vi.mock('redis', () => ({
  createClient: () => fakeClient,
}));

vi.mock('@op/logging', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

process.env.REDIS_URL = 'redis://localhost:6379';

const { consumeSlidingWindow } = await import('./rateLimit');

const replies = (count: number, oldest: number | null): Reply[] => {
  const oldestEntry =
    oldest === null ? [] : [{ score: oldest, value: `${oldest}:test` }];
  return [0, undefined, count, 'OK', oldestEntry];
};

describe('consumeSlidingWindow — redis tier', () => {
  beforeEach(() => {
    fakeClient.isOpen = true;
    fakeMulti.zRemRangeByScore.mockClear().mockReturnThis();
    fakeMulti.zAdd.mockClear().mockReturnThis();
    fakeMulti.zCard.mockClear().mockReturnThis();
    fakeMulti.pExpire.mockClear().mockReturnThis();
    fakeMulti.zRangeWithScores.mockClear().mockReturnThis();
    fakeMulti.exec.mockReset();
  });

  it('returns allowed=true and the new count when below the limit', async () => {
    fakeMulti.exec.mockResolvedValue(replies(1, 1_000));

    const result = await consumeSlidingWindow({
      key: 'rl:user-a:/login',
      windowMs: 10_000,
      maxRequests: 3,
      now: () => 1_500,
    });

    expect(result.allowed).toBe(true);
    expect(result.count).toBe(1);
    expect(result.resetMs).toBeGreaterThan(0);
    expect(fakeMulti.zRemRangeByScore).toHaveBeenCalledWith(
      'rl:user-a:/login',
      0,
      1_500 - 10_000,
    );
  });

  it('returns allowed=false when the new request would push the bucket over the limit', async () => {
    fakeMulti.exec.mockResolvedValue(replies(4, 100));

    const result = await consumeSlidingWindow({
      key: 'rl:user-b:/login',
      windowMs: 10_000,
      maxRequests: 3,
      now: () => 5_000,
    });

    expect(result.allowed).toBe(false);
    expect(result.count).toBe(4);
  });

  it('reports resetMs based on the oldest in-window hit and the window width', async () => {
    fakeMulti.exec.mockResolvedValue(replies(2, 800));

    const result = await consumeSlidingWindow({
      key: 'rl:user-c:/login',
      windowMs: 10_000,
      maxRequests: 3,
      now: () => 1_000,
    });

    // oldest=800, window=10_000 → reset at 10_800; under fake clock, ~10_000+ wait.
    expect(result.resetMs).toBeGreaterThan(0);
  });

  it('falls through to the in-process LRU when redis is closed', async () => {
    fakeClient.isOpen = false;

    const first = await consumeSlidingWindow({
      key: 'rl:fallback:/x',
      windowMs: 10_000,
      maxRequests: 2,
      now: () => 1_000,
    });
    const second = await consumeSlidingWindow({
      key: 'rl:fallback:/x',
      windowMs: 10_000,
      maxRequests: 2,
      now: () => 2_000,
    });
    const third = await consumeSlidingWindow({
      key: 'rl:fallback:/x',
      windowMs: 10_000,
      maxRequests: 2,
      now: () => 3_000,
    });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.count).toBe(3);
    expect(fakeMulti.exec).not.toHaveBeenCalled();
  });

  it('falls through to the LRU when redis throws — and never leaks the error to the caller', async () => {
    fakeMulti.exec.mockRejectedValue(new Error('connection refused'));

    const result = await consumeSlidingWindow({
      key: 'rl:throws:/x',
      windowMs: 10_000,
      maxRequests: 10,
      now: () => 1_000,
    });

    expect(result.allowed).toBe(true);
    expect(result.count).toBe(1);
  });

  it('treats different keys as independent buckets in the LRU fallback', async () => {
    fakeClient.isOpen = false;

    const a1 = await consumeSlidingWindow({
      key: 'rl:user-a:/x',
      windowMs: 10_000,
      maxRequests: 1,
      now: () => 1_000,
    });
    const a2 = await consumeSlidingWindow({
      key: 'rl:user-a:/x',
      windowMs: 10_000,
      maxRequests: 1,
      now: () => 1_500,
    });
    const b1 = await consumeSlidingWindow({
      key: 'rl:user-b:/x',
      windowMs: 10_000,
      maxRequests: 1,
      now: () => 1_500,
    });

    expect(a1.allowed).toBe(true);
    expect(a2.allowed).toBe(false);
    expect(b1.allowed).toBe(true);
  });

  it('LRU fallback ages out entries past the window so the bucket recovers', async () => {
    fakeClient.isOpen = false;

    const k = 'rl:expiry:/x';
    const inWindow = await consumeSlidingWindow({
      key: k,
      windowMs: 10_000,
      maxRequests: 1,
      now: () => 1_000,
    });
    const blocked = await consumeSlidingWindow({
      key: k,
      windowMs: 10_000,
      maxRequests: 1,
      now: () => 2_000,
    });
    const afterWindow = await consumeSlidingWindow({
      key: k,
      windowMs: 10_000,
      maxRequests: 1,
      now: () => 20_000,
    });

    expect(inWindow.allowed).toBe(true);
    expect(blocked.allowed).toBe(false);
    expect(afterWindow.allowed).toBe(true);
    expect(afterWindow.count).toBe(1);
  });
});
