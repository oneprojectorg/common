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
const { cache, cacheMany, get, set } = await import('./kv');
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

  it('does not collapse "/" in exact-identifier keys (decision slug aliasing)', async () => {
    fakeRedis.get.mockResolvedValue(null);
    fakeRedis.setEx.mockResolvedValue('OK');

    const fetcher = vi.fn().mockResolvedValue('row');
    // A crafted slug like "crafted/victim-slug" must NOT read/write the same
    // key as "victim-slug" — 'decision' is a FULL_KEY_TYPES member because its
    // first param can be caller-supplied request input.
    await cache({
      type: 'decision',
      params: ['crafted/victim-slug', 'slugProfile'],
      options: { skipMemCache: true },
      fetch: fetcher,
    });
    await cache({
      type: 'decision',
      params: ['victim-slug', 'slugProfile'],
      options: { skipMemCache: true },
      fetch: fetcher,
    });

    const requestedKeys = fakeRedis.get.mock.calls.map(([key]) => key);
    expect(requestedKeys).toEqual([
      'dev/v1/common/decision/crafted/victim-slug:slugProfile',
      'dev/v1/common/decision/victim-slug:slugProfile',
    ]);
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

describe('cacheMany()', () => {
  beforeEach(() => {
    fakeRedis.get.mockReset();
    fakeRedis.setEx.mockReset();
    fakeRedis.del.mockReset();
    fakeRedis.setEx.mockResolvedValue('OK');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches only the missing ids in a single batch and merges cached hits', async () => {
    // `cached-1` is warm in Redis; `miss-1` / `miss-2` are cold. The batch
    // fetch must see ONLY the two cold ids, exactly once.
    fakeRedis.get.mockImplementation(async (key: string) =>
      key.includes('cached-1') ? JSON.stringify('url-cached-1') : null,
    );

    const fetchMissing = vi.fn(async (missingIds: string[]) => {
      return new Map(missingIds.map((id) => [id, `url-${id}`]));
    });

    const result = await cacheMany<string>({
      type: 'resourceSignedUrl',
      ids: ['cached-1', 'miss-1', 'miss-2'],
      options: { skipMemCache: true },
      fetchMissing,
    });

    expect(fetchMissing).toHaveBeenCalledOnce();
    expect(fetchMissing).toHaveBeenCalledWith(['miss-1', 'miss-2']);
    expect(result).toEqual(
      new Map([
        ['cached-1', 'url-cached-1'],
        ['miss-1', 'url-miss-1'],
        ['miss-2', 'url-miss-2'],
      ]),
    );
  });

  it('deduplicates repeated ids before fetching', async () => {
    fakeRedis.get.mockResolvedValue(null);

    const fetchMissing = vi.fn(async (missingIds: string[]) => {
      return new Map(missingIds.map((id) => [id, `url-${id}`]));
    });

    const result = await cacheMany<string>({
      type: 'resourceSignedUrl',
      ids: ['dup-a', 'dup-a', 'dup-b'],
      options: { skipMemCache: true },
      fetchMissing,
    });

    expect(fetchMissing).toHaveBeenCalledWith(['dup-a', 'dup-b']);
    expect(result.get('dup-a')).toBe('url-dup-a');
    expect(result.get('dup-b')).toBe('url-dup-b');
  });

  it('returns null for ids the batch fetch omits, and skips fetch entirely when empty', async () => {
    fakeRedis.get.mockResolvedValue(null);

    // Fetch resolves only one of the two requested ids.
    const fetchMissing = vi.fn(
      async () => new Map([['present', 'url-present']]),
    );

    const result = await cacheMany<string>({
      type: 'resourceSignedUrl',
      ids: ['present', 'absent'],
      options: { skipMemCache: true },
      fetchMissing,
    });

    expect(result.get('present')).toBe('url-present');
    expect(result.get('absent')).toBeNull();

    const emptyFetch = vi.fn(async () => new Map<string, string>());
    const empty = await cacheMany<string>({
      type: 'resourceSignedUrl',
      ids: [],
      fetchMissing: emptyFetch,
    });
    expect(empty.size).toBe(0);
    expect(emptyFetch).not.toHaveBeenCalled();
  });

  it('writes fetched values to Redis so a later read is a hit', async () => {
    fakeRedis.get.mockResolvedValue(null);

    await cacheMany<string>({
      type: 'resourceSignedUrl',
      ids: ['write-1'],
      extraParams: ['900'],
      options: { skipMemCache: true, ttl: 5000 },
      fetchMissing: async () => new Map([['write-1', 'url-write-1']]),
    });

    // TTL (ms) is converted to seconds for the Redis SETEX.
    expect(fakeRedis.setEx).toHaveBeenCalledWith(
      'dev/v1/common/resourceSignedUrl/write-1:900',
      5,
      JSON.stringify('url-write-1'),
    );
  });

  it('does not cache omitted (null) ids by default, so they re-fetch', async () => {
    fakeRedis.get.mockResolvedValue(null);

    await cacheMany<string>({
      type: 'resourceSignedUrl',
      ids: ['no-store'],
      options: { skipMemCache: true },
      fetchMissing: async () => new Map<string, string>(),
    });

    const wroteNull = fakeRedis.setEx.mock.calls.some(([key]) =>
      key.includes('no-store'),
    );
    expect(wroteNull).toBe(false);
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
