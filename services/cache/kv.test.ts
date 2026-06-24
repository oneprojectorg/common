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
    await expect(set('k', { a: 1 }, 60)).resolves.toBeUndefined();
    expect(recordTimeout).toHaveBeenCalledWith({ layer: 'command' });
    expect(recordError).not.toHaveBeenCalled();
  });

  it('records an error when setEx rejects with a non-abort error', async () => {
    fakeRedis.setEx.mockRejectedValue(new Error('connection refused'));
    await expect(set('k', { a: 1 }, 60)).resolves.toBeUndefined();
    expect(recordError).toHaveBeenCalledWith('set');
    expect(recordTimeout).not.toHaveBeenCalled();
  });
});

describe('cache() — per-type Redis TTL', () => {
  beforeEach(() => {
    fakeRedis.get.mockReset();
    fakeRedis.setEx.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Each row pins one type to the per-type default the cache layer must
  // apply on a write when the caller omits `options.ttl`. These guard
  // against a regression of the old shared 72h default that the audit
  // (ONE-40 #19) flagged as a multi-day staleness window on auth-shaped
  // surfaces (user / orgUser / profileUser / organization).
  it.each([
    ['user', 5 * 60],
    ['orgUser', 5 * 60],
    ['profileUser', 5 * 60],
    ['profile', 5 * 60],
    ['organization', 10 * 60],
    ['allowList', 5 * 60],
    ['decision', 5 * 60],
    ['platform', 5 * 60],
    ['linkPreview', 60 * 60],
    ['resourceSignedUrl', 10 * 60],
    ['geonames', 24 * 60 * 60],
    ['reverseGeocode', 24 * 60 * 60],
    ['search', 30],
  ] as const)(
    'writes type %s with the per-type default ttl (%i seconds) when the caller omits ttl',
    async (type, expectedTtl) => {
      fakeRedis.get.mockResolvedValue(null);
      fakeRedis.setEx.mockResolvedValue('OK');

      await cache({
        type,
        // a fresh param per type keeps the L1 LRU from short-circuiting the write.
        params: [`ttl-default-${type}`],
        options: { skipMemCache: true },
        fetch: async () => ({ ok: true }),
      });

      expect(fakeRedis.setEx).toHaveBeenCalledWith(
        expect.any(String),
        expectedTtl,
        expect.any(String),
      );
    },
  );

  it('honors an explicit options.ttl (in ms) and ignores the per-type default', async () => {
    fakeRedis.get.mockResolvedValue(null);
    fakeRedis.setEx.mockResolvedValue('OK');

    await cache({
      type: 'user',
      params: ['ttl-explicit'],
      options: { skipMemCache: true, ttl: 90 * 1000 },
      fetch: async () => ({ ok: true }),
    });

    expect(fakeRedis.setEx).toHaveBeenCalledWith(
      expect.any(String),
      90,
      expect.any(String),
    );
  });
});

describe('invalidate() — per-type Redis TTL on data write', () => {
  beforeEach(() => {
    fakeRedis.setEx.mockReset();
    fakeRedis.del.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the per-type ttl when invalidating with data', async () => {
    fakeRedis.setEx.mockResolvedValue('OK');

    await invalidate({
      type: 'organization',
      params: ['invalidate-data'],
      data: { ok: true },
    });

    expect(fakeRedis.setEx).toHaveBeenCalledWith(
      expect.any(String),
      10 * 60,
      expect.any(String),
    );
  });

  it('routes a no-data invalidate to redis.del (ttl irrelevant)', async () => {
    fakeRedis.del.mockResolvedValue(1);

    await invalidate({ type: 'user', params: ['invalidate-clear'] });

    expect(fakeRedis.del).toHaveBeenCalledTimes(1);
    expect(fakeRedis.setEx).not.toHaveBeenCalled();
  });
});
