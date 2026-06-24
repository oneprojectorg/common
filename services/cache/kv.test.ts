import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Tracks the fake Redis state that the tests configure between runs. Lives at
// module scope so the `vi.mock('redis', …)` factory (which is hoisted above
// imports) can close over it.
type FakeRedis = {
  isOpen: boolean;
  on: Mock;
  connect: Mock;
  get: Mock<(key: string) => Promise<string | null>>;
  setEx: Mock<(key: string, ttl: number, data: string) => Promise<unknown>>;
  del: Mock<(key: string) => Promise<unknown>>;
  withAbortSignal: (signal: AbortSignal) => {
    get: (key: string) => Promise<string | null>;
    setEx: (key: string, ttl: number, data: string) => Promise<unknown>;
    del: (key: string) => Promise<unknown>;
  };
};

const fakeRedis: FakeRedis = {
  isOpen: true,
  on: vi.fn(),
  connect: vi.fn(),
  get: vi.fn<(key: string) => Promise<string | null>>(),
  setEx: vi.fn<(key: string, ttl: number, data: string) => Promise<unknown>>(),
  del: vi.fn<(key: string) => Promise<unknown>>(),
  // Real node-redis returns a proxy client scoped to the AbortSignal. The
  // shim here calls the underlying mock but races it against the signal,
  // so a signal that fires before the get/set/del resolves rejects the
  // operation (mimicking the per-command socket timeout).
  withAbortSignal: (signal: AbortSignal) => ({
    get: (key: string) => raceWithSignal(fakeRedis.get(key), signal),
    setEx: (key: string, ttl: number, data: string) =>
      raceWithSignal(fakeRedis.setEx(key, ttl, data), signal),
    del: (key: string) => raceWithSignal(fakeRedis.del(key), signal),
  }),
};

vi.mock('redis', () => ({
  createClient: () => fakeRedis,
}));

vi.mock('@vercel/functions', () => ({
  waitUntil: (p: Promise<unknown>) => p,
}));

vi.mock('@op/logging', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  metrics: {
    getMeter: () => ({
      createCounter: () => ({ add: vi.fn() }),
    }),
  },
}));

vi.mock('@op/core', () => ({
  OPURLConfig: () => ({ IS_PRODUCTION: false }),
}));

process.env.REDIS_URL = 'redis://localhost:6379';

// Imported AFTER the mocks so kv.ts picks up the fake redis client and the
// mocked logger/metrics modules.
const { cache, get, invalidate, set } = await import('./kv');
const { cacheMetrics } = await import('./metrics');

function raceWithSignal<T>(p: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      return;
    }
    const onAbort = () =>
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    signal.addEventListener('abort', onAbort, { once: true });
    p.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (err) => {
        signal.removeEventListener('abort', onAbort);
        reject(err);
      },
    );
  });
}

describe('cache() — Redis tier metrics', () => {
  let recordHit: ReturnType<typeof vi.spyOn>;
  let recordMiss: ReturnType<typeof vi.spyOn>;
  let recordTimeout: ReturnType<typeof vi.spyOn>;
  let recordError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fakeRedis.get.mockReset();
    fakeRedis.setEx.mockReset();
    fakeRedis.del.mockReset();
    recordHit = vi.spyOn(cacheMetrics, 'recordHit');
    recordMiss = vi.spyOn(cacheMetrics, 'recordMiss');
    recordTimeout = vi.spyOn(cacheMetrics, 'recordTimeout');
    recordError = vi.spyOn(cacheMetrics, 'recordError');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('records a redis hit and returns the cached value', async () => {
    fakeRedis.get.mockResolvedValue(JSON.stringify({ ok: true }));

    const fetcher = vi.fn();
    const value = await cache({
      type: 'platform',
      // unique param so the in-process memcache from an earlier test does not leak.
      params: ['hit-1'],
      options: { skipMemCache: true },
      fetch: fetcher,
    });

    expect(value).toEqual({ ok: true });
    expect(fetcher).not.toHaveBeenCalled();
    expect(recordHit).toHaveBeenCalledWith({
      type: 'kv',
      source: 'redis',
      keyType: 'platform',
    });
    expect(recordTimeout).not.toHaveBeenCalled();
    expect(recordMiss).not.toHaveBeenCalled();
  });

  it('records a true miss (redis returned null) and falls back to fetch', async () => {
    fakeRedis.get.mockResolvedValue(null);
    fakeRedis.setEx.mockResolvedValue('OK');

    const fetcher = vi.fn().mockResolvedValue('from-db');
    const value = await cache({
      type: 'platform',
      params: ['miss-1'],
      options: { skipMemCache: true },
      fetch: fetcher,
    });

    expect(value).toBe('from-db');
    expect(fetcher).toHaveBeenCalledOnce();
    expect(recordMiss).toHaveBeenCalledWith('platform');
    expect(recordTimeout).not.toHaveBeenCalled();
  });

  it('records a command timeout (not a miss) when Redis is too slow', async () => {
    // A redis.get that never resolves forces the per-command AbortSignal
    // (REDIS_COMMAND_TIMEOUT_MS = 50ms) to fire. The cache layer should
    // surface that as `recordTimeout({layer:'command'})`, NOT recordMiss.
    fakeRedis.get.mockImplementation(() => new Promise<string>(() => {}));
    fakeRedis.setEx.mockResolvedValue('OK');

    const fetcher = vi.fn().mockResolvedValue('from-db');
    const value = await cache({
      type: 'platform',
      params: ['timeout-1'],
      options: { skipMemCache: true },
      fetch: fetcher,
    });

    expect(value).toBe('from-db');
    expect(fetcher).toHaveBeenCalledOnce();
    expect(recordTimeout).toHaveBeenCalledWith({
      layer: 'command',
      keyType: 'platform',
    });
    expect(recordMiss).not.toHaveBeenCalled();
    expect(recordHit).not.toHaveBeenCalled();
  });

  it('records an error (not a timeout) when redis.get rejects with a non-abort error', async () => {
    fakeRedis.get.mockRejectedValue(new Error('connection refused'));
    fakeRedis.setEx.mockResolvedValue('OK');

    const fetcher = vi.fn().mockResolvedValue('from-db');
    const value = await cache({
      type: 'platform',
      params: ['err-1'],
      options: { skipMemCache: true },
      fetch: fetcher,
    });

    expect(value).toBe('from-db');
    expect(recordError).toHaveBeenCalledWith('get');
    expect(recordMiss).toHaveBeenCalledWith('platform');
    expect(recordTimeout).not.toHaveBeenCalled();
  });
});

describe('cache() — in-process LRU (L1)', () => {
  beforeEach(() => {
    fakeRedis.get.mockReset();
    fakeRedis.setEx.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('serves a repeat read from the L1 LRU without re-consulting Redis or fetch', async () => {
    fakeRedis.get.mockResolvedValue(null);
    fakeRedis.setEx.mockResolvedValue('OK');

    const fetcher = vi.fn().mockResolvedValue('db-value');

    // First read: Redis miss → fetch → populates L1.
    const first = await cache({
      type: 'platform',
      params: ['lru-1'],
      fetch: fetcher,
    });
    expect(first).toBe('db-value');
    expect(fetcher).toHaveBeenCalledOnce();

    const redisGetsAfterFirst = fakeRedis.get.mock.calls.length;

    // Second read of the same key: should hit the in-process LRU and skip
    // both the fetch function and Redis entirely.
    const second = await cache({
      type: 'platform',
      params: ['lru-1'],
      fetch: fetcher,
    });
    expect(second).toBe('db-value');
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fakeRedis.get.mock.calls.length).toBe(redisGetsAfterFirst);
  });
});

describe('cache() — permission-sensitive types skip the L1 memCache', () => {
  // Stale L1 entries on these types let an instance keep serving a value
  // (admin / membership / role) for up to the L1 TTL after another instance
  // invalidated it. We force every read for these types straight to Redis
  // so the 1s Redis tombstone written by invalidate() is honored everywhere.
  beforeEach(() => {
    fakeRedis.get.mockReset();
    fakeRedis.setEx.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(['user', 'orgUser', 'profileUser'] as const)(
    're-reads Redis on every cache() call for %s (never serves from L1)',
    async (type) => {
      fakeRedis.get.mockResolvedValue(JSON.stringify({ admin: true }));
      fakeRedis.setEx.mockResolvedValue('OK');

      const fetcher = vi.fn();
      const params = [`${type}-skip-memcache`];

      const first = await cache({ type, params, fetch: fetcher });
      expect(first).toEqual({ admin: true });
      const callsAfterFirst = fakeRedis.get.mock.calls.length;

      const second = await cache({ type, params, fetch: fetcher });
      expect(second).toEqual({ admin: true });
      expect(fakeRedis.get.mock.calls.length).toBeGreaterThan(callsAfterFirst);
    },
  );

  it.each(['user', 'orgUser', 'profileUser'] as const)(
    'does not surface a memory-tier hit metric on a repeat read for %s',
    async (type) => {
      fakeRedis.get.mockResolvedValue(JSON.stringify({ ok: true }));
      const recordHit = vi.spyOn(cacheMetrics, 'recordHit');

      const params = [`${type}-no-memory-hit`];
      const fetcher = vi.fn();
      await cache({ type, params, fetch: fetcher });
      await cache({ type, params, fetch: fetcher });

      const memoryHits = recordHit.mock.calls.filter(
        ([arg]) => arg.type === 'memory',
      );
      expect(memoryHits).toHaveLength(0);
    },
  );
});

describe('invalidate() — permission-sensitive types', () => {
  beforeEach(() => {
    fakeRedis.get.mockReset();
    fakeRedis.setEx.mockReset();
    fakeRedis.del.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not populate the L1 memCache when given data for user type', async () => {
    fakeRedis.setEx.mockResolvedValue('OK');
    // After invalidate writes the new value, a follow-up read must come from
    // Redis (where we control the response) — not from the L1 invalidate just
    // tried to seed.
    fakeRedis.get.mockResolvedValue(JSON.stringify({ admin: false }));

    await invalidate({
      type: 'user',
      params: ['authoritative-user'],
      data: { admin: true },
    });

    const fetcher = vi.fn();
    const result = await cache({
      type: 'user',
      params: ['authoritative-user'],
      fetch: fetcher,
    });

    expect(result).toEqual({ admin: false });
    expect(fakeRedis.get).toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('get()', () => {
  beforeEach(() => {
    fakeRedis.get.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the parsed value on hit', async () => {
    fakeRedis.get.mockResolvedValue(JSON.stringify({ id: 1 }));
    await expect(get('some-key')).resolves.toEqual({ id: 1 });
  });

  it('returns null on a Redis miss', async () => {
    fakeRedis.get.mockResolvedValue(null);
    await expect(get('some-key')).resolves.toBeNull();
  });

  it('returns null on a command timeout (does not throw to callers)', async () => {
    fakeRedis.get.mockImplementation(() => new Promise<string>(() => {}));
    await expect(get('some-key')).resolves.toBeNull();
  });

  it('returns null on a non-timeout error (does not throw)', async () => {
    fakeRedis.get.mockRejectedValue(new Error('boom'));
    await expect(get('some-key')).resolves.toBeNull();
  });
});

describe('set()', () => {
  let recordTimeout: ReturnType<typeof vi.spyOn>;
  let recordError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fakeRedis.setEx.mockReset();
    fakeRedis.del.mockReset();
    recordTimeout = vi.spyOn(cacheMetrics, 'recordTimeout');
    recordError = vi.spyOn(cacheMetrics, 'recordError');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('records a command timeout when setEx is too slow, does not throw', async () => {
    fakeRedis.setEx.mockImplementation(() => new Promise<string>(() => {}));
    await expect(set('k', { a: 1 })).resolves.toBeUndefined();
    expect(recordTimeout).toHaveBeenCalledWith({ layer: 'command' });
    expect(recordError).not.toHaveBeenCalled();
  });

  it('records an error when setEx rejects with a non-abort error', async () => {
    fakeRedis.setEx.mockRejectedValue(new Error('connection refused'));
    await expect(set('k', { a: 1 })).resolves.toBeUndefined();
    expect(recordError).toHaveBeenCalledWith('set');
    expect(recordTimeout).not.toHaveBeenCalled();
  });
});
