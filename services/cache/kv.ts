import { OPURLConfig } from '@op/core';
import { logger } from '@op/logging';
import { waitUntil } from '@vercel/functions';
import { LRUCache } from 'lru-cache';
import { createClient } from 'redis';

import { cacheMetrics } from './metrics';

const REDIS_URL = process.env.REDIS_URL;

// Outer race timeout: how long `cache()` is willing to wait on Redis before
// falling through to the source. Sized for the 99th-percentile Redis call.
const REDIS_RACE_TIMEOUT_MS = 300;

// Per-command socket timeout: aborts individual Redis commands so a stuck
// socket fails fast instead of hanging until REDIS_RACE_TIMEOUT_MS. Sized with
// margin for network jitter / TLS; watch `cache.timeouts{layer:"command"}` to
// confirm it isn't clipping successful commands.
const REDIS_COMMAND_TIMEOUT_MS = 100;

// Sentinel for `Promise.race` — distinguishes the race timeout from a
// legitimate `null` returned by Redis (cache miss).
const RACE_TIMEOUT: unique symbol = Symbol('cache.race-timeout');

// Discriminated result of an attempted Redis read. `cache()` uses it to
// record `hit` / `miss` / `timeout` separately so a Redis slowdown does
// not masquerade as a cold cache.
//
// `miss` means Redis answered and held nothing. `timeout` and `error` mean
// Redis did not answer, which is a different claim. A caller that treats them
// as a miss states the key is absent, when it only knows it could not look.
// A caller that holds cache-only state needs that distinction. See
// `getWithStatus`.
export type RedisGetResult =
  | { status: 'hit'; data: unknown }
  | { status: 'miss' }
  | { status: 'timeout' }
  | { status: 'error' };

// Create Redis client only if REDIS_URL is provided
let redis: ReturnType<typeof createClient> | null = null;

if (REDIS_URL) {
  redis = createClient({
    url: REDIS_URL,
    disableOfflineQueue: true,
    socket: {
      connectTimeout: 10_000,
      keepAlive: false, // TCP keepalive
      reconnectStrategy: (retries) => {
        if (retries > 3) {
          return false;
        }

        const jitter = Math.floor(Math.random() * 100);

        return Math.min(retries * 500, 5_000) + jitter;
      },
    },
  });

  redis.on('error', (err) => {
    logger.error('Redis Client Error', { error: err });
  });

  // Connect to Redis
  if (!redis.isOpen) {
    redis.connect().catch((error) => {
      logger.error('Redis connect failed', { error });
    });
  }
}

const TypeMap = {
  search: 'search',
  geonames: 'geonames',
  reverseGeocode: 'reverseGeocode',
  organization: 'org',
  allowList: 'allowList',
  linkPreview: 'linkPreview',
  resourceSignedUrl: 'resourceSignedUrl',
  resources: 'resources',
  user: 'user',
  orgUser: 'orgUser',
  profileUser: 'profileUser',
  profile: 'profile',
  decision: 'decision',
  platform: 'platform',
  collabDoc: 'collabDoc',
};

/** Allowed types for cache params - will be stringified for key generation */
type CacheParam = string | number | boolean | undefined | null | string[];
type CacheParams = CacheParam[];

// Types whose first param is an exact identifier (URL, file path, id, or a
// caller-supplied slug) and must NOT be collapsed to the last '/'-segment.
// The default slug collapse exists so CMS pages can move without a 404, but
// for these types it would cause cross-key collisions — and for keys built
// from request input (e.g. decision slugs) it would let a crafted value like
// "x/victim-slug" alias another entry's key.
const FULL_KEY_TYPES: ReadonlySet<keyof typeof TypeMap> = new Set([
  'linkPreview',
  'resourceSignedUrl',
  'decision',
  'resources',
]);

const getCacheKey = (
  type: keyof typeof TypeMap,
  appKey: string | undefined,
  params: CacheParams,
) => {
  const resolvedAppKey = appKey ?? 'common';
  const apiVersion = OPURLConfig('API').IS_PRODUCTION ? 'v1' : 'dev/v1';
  const key = TypeMap[type];
  // Stringify params for cache key - handles arrays, undefined, etc.
  const stringParams = params
    .flat()
    .map((p) => (p === undefined || p === null ? '' : String(p)))
    .filter(Boolean);
  const [fullSlug, ...otherParams] = stringParams;

  // For slug-based types only: keep the last path segment so a page can be
  // moved without invalidating its cache. For URL/path types, use the full
  // value verbatim (two different URLs with the same trailing segment must
  // not collide).
  const slug = FULL_KEY_TYPES.has(type)
    ? (fullSlug ?? '')
    : (fullSlug?.split('/').slice(-1)[0] ?? '');
  return `${apiVersion}/${resolvedAppKey}/${key}/${slug}${
    otherParams?.length ? `:${otherParams.join(':')}` : ''
  }`;
};

// In-process L1 cache (memcache → Redis → fetch). Bounded by both a per-entry
// TTL and a total memory budget with LRU eviction, so a long-lived server
// process can't grow this unbounded. A `null` data field is a deliberately
// cached negative result (see `storeNulls`); the wrapper object is always
// truthy so `cache()` can tell a cached null apart from a miss.
type MemCacheEntry = { data: unknown };
const MEMCACHE_EXPIRE = 2 * 60 * 1000;
// Total memory budget for the L1 cache (~200 MB), measured by the approximate
// serialized byte size of each entry's data (see `estimateEntrySize`).
const MEMCACHE_MAX_BYTES = 200 * 1024 * 1024;
// Per-entry cap (~30 MB). An entry larger than this is simply not cached
// (falls through to Redis) rather than being admitted and evicting most of the
// cache to make room — without this, `maxEntrySize` would default to `maxSize`
// and a single fat payload could thrash the whole L1.
const MEMCACHE_MAX_ENTRY_BYTES = 30 * 1024 * 1024;

// Approximate an entry's in-memory footprint by its serialized JSON byte
// length. lru-cache requires a positive integer, and a throw here would break
// the cache write, so non-serializable values fall back to a nominal cost.
const estimateEntrySize = (entry: MemCacheEntry): number => {
  try {
    const json = JSON.stringify(entry.data);
    return json ? Buffer.byteLength(json) : 1;
  } catch {
    return 1;
  }
};

const memCache = new LRUCache<string, MemCacheEntry>({
  maxSize: MEMCACHE_MAX_BYTES,
  maxEntrySize: MEMCACHE_MAX_ENTRY_BYTES,
  ttl: MEMCACHE_EXPIRE,
  sizeCalculation: estimateEntrySize,
});

/**
 * Caches values into a tiered structure: memcache → Redis → fetch function.
 *
 * @param type - Cache key type from TypeMap
 * @param appKey - Application key (defaults to 'common')
 * @param params - Parameters used to build the cache key
 * @param fetch - Function to call on cache miss
 * @param options.skipMemCache - Skip in-memory cache layer
 * @param options.storeNulls - Cache null results to avoid repeated DB lookups
 * @param options.ttl - Time-to-live in milliseconds
 * @param options.skipCacheWrite - Predicate to conditionally skip caching based on result.
 *                            When returns true, the result is NOT stored in cache.
 *                            Useful for skipping cache on draft/incomplete data.
 */
export const cache = async <T>({
  type,
  appKey,
  params = [],
  fetch,
  options = {},
}: {
  type: keyof typeof TypeMap;
  appKey?: string;
  params?: CacheParams;
  fetch: () => Promise<Awaited<T>>;
  options?: {
    skipMemCache?: boolean;
    storeNulls?: boolean;
    ttl?: number;
    skipCacheWrite?: (result: Awaited<T>) => boolean;
  };
}): Promise<Awaited<T>> => {
  const cacheKey = getCacheKey(type, appKey, params);
  const { ttl, skipMemCache = false, storeNulls = false } = options;
  // The LRU's per-entry TTL replaces the manual `createdAt` expiry check. A
  // caller-supplied `ttl` (ms) overrides the default on write. Use `||` (not
  // `??`) so a falsy `ttl` of 0 falls back to the default rather than becoming
  // an immortal entry — matching the Redis-side `ttl ? …` guard below.
  const memTtl = ttl || MEMCACHE_EXPIRE;

  // try memcache first — the LRU returns `undefined` for entries that have
  // expired or been evicted, so a stale read simply falls through to Redis.
  const cachedVal = !skipMemCache ? memCache.get(cacheKey) : undefined;
  if (cachedVal) {
    cacheMetrics.recordHit({ type: 'memory', keyType: type });
    return cachedVal.data as Awaited<T>;
  }

  // fall back to Redis cache
  //
  // Two timeouts cover Redis slowness, in order of likelihood:
  //   1. `tryGetFromRedis` applies a per-command socket timeout
  //      (REDIS_COMMAND_TIMEOUT_MS) so a stuck connection fails fast.
  //   2. The outer Promise.race below is the belt-and-suspenders fallback
  //      (REDIS_RACE_TIMEOUT_MS) for anything the client doesn't abort —
  //      including a fully saturated event loop.
  //
  // Whichever fires, the outcome is recorded as a `cache.timeouts` event
  // and NOT as a `cache.misses` — those two signals are different (Redis
  // is slow vs Redis is cold) and need separate dashboards.
  const raceTimeout = new Promise<typeof RACE_TIMEOUT>((resolve) => {
    setTimeout(() => resolve(RACE_TIMEOUT), REDIS_RACE_TIMEOUT_MS);
  });

  const raced = await Promise.race([tryGetFromRedis(cacheKey), raceTimeout]);

  if (raced === RACE_TIMEOUT) {
    cacheMetrics.recordTimeout({ layer: 'race', keyType: type });
  } else if (raced.status === 'hit') {
    cacheMetrics.recordHit({ type: 'kv', source: 'redis', keyType: type });
    memCache.set(cacheKey, { data: raced.data }, { ttl: memTtl });
    return raced.data as Awaited<T>;
  } else if (raced.status === 'timeout') {
    cacheMetrics.recordTimeout({ layer: 'command', keyType: type });
  } else {
    cacheMetrics.recordMiss(type);
  }

  // finally retrieve the data from the DB
  const newData = await fetch();

  const shouldSkipCache = options.skipCacheWrite?.(newData) ?? false;

  if (newData && !shouldSkipCache) {
    memCache.set(cacheKey, { data: newData }, { ttl: memTtl });
    // don't cache if we couldn't find the record (?)
    // TTL in redis is in seconds
    waitUntil(set(cacheKey, newData, ttl ? ttl / 1000 : 72 * 60 * 60)); // 72h default cache
  } else if (storeNulls && !shouldSkipCache) {
    // This allows us to store negative values in the memcache to improve rejections as well (and avoid DB calls for repeated rejections)
    memCache.set(cacheKey, { data: null }, { ttl: memTtl });
  }

  return newData;
};

export const invalidate = async ({
  type,
  appKey,
  params,
  data,
}: {
  type: keyof typeof TypeMap;
  appKey?: string;
  params: CacheParams;
  data?: unknown;
}) => {
  const cacheKey = getCacheKey(type, appKey, params);

  // TODO: support invalidating entire trees
  if (data) {
    memCache.set(cacheKey, { data });
    await set(cacheKey, data);
  } else {
    memCache.delete(cacheKey);
    // Await the Redis del — callers that `await invalidate(...)` (rather than
    // wrapping in `waitUntil`) rely on the entry being cleared before they
    // return. Without this, a writer's response can race ahead of the Redis
    // round-trip, letting a follow-up read serve the stale Redis copy.
    await set(cacheKey, null, 1000);
  }
};

export const invalidateMultiple = async ({
  type,
  appKey,
  paramsList,
}: {
  type: keyof typeof TypeMap;
  appKey?: string;
  paramsList: CacheParams[];
}) => {
  await Promise.all(
    paramsList.map((params) =>
      invalidate({
        type,
        appKey,
        params,
      }),
    ),
  );
};

// Internal: returns a discriminated result so `cache()` can split hit / miss
// / timeout into different metrics. Public `get()` still maps everything
// non-hit to `null` for back-compat.
const tryGetFromRedis = async (key: string): Promise<RedisGetResult> => {
  if (!redis) {
    return { status: 'miss' };
  }

  const signal = AbortSignal.timeout(REDIS_COMMAND_TIMEOUT_MS);

  try {
    const data = await redis.withAbortSignal(signal).get(key);

    if (!data) {
      return { status: 'miss' };
    }

    return { status: 'hit', data: JSON.parse(data) };
  } catch (e) {
    if (signal.aborted) {
      // The per-command socket timeout fired — surface as a timeout so the
      // caller records it separately from a true cache miss. We don't log
      // here because timeouts are an expected (counted) signal at high
      // load; a log line per event would be too noisy.
      return { status: 'timeout' };
    }

    logger.error('CACHE: error getting from Redis', { error: e });
    cacheMetrics.recordError('get');

    return { status: 'error' };
  }
};

export const get = async (key: string) => {
  const result = await tryGetFromRedis(key);
  return result.status === 'hit' ? result.data : null;
};

/**
 * Reads a key. Keeps "Redis held nothing" apart from "Redis did not answer".
 *
 * {@link get} collapses both to `null`. That suits any caller that can
 * re-derive its value from the source on a miss.
 *
 * It does not suit cache-only state, where absence carries meaning. A caller
 * that reads "no such record" after a command timed out can discard a record
 * that is still there. Use this function when a false miss costs the user data
 * instead of one round trip.
 */
export const getWithStatus = async (key: string): Promise<RedisGetResult> =>
  tryGetFromRedis(key);

// const DEFAULT_TTL = 3600 * 24 * 30; // 3600 * 24 = 1 day
const DEFAULT_TTL = 3600; // short TTL for testing
export const set = async (key: string, data: unknown, ttl?: number) => {
  if (!redis) {
    return;
  }

  const signal = AbortSignal.timeout(REDIS_COMMAND_TIMEOUT_MS);

  try {
    const serializedData = JSON.stringify(data);
    const scopedRedis = redis.withAbortSignal(signal);
    if (data === null) {
      await scopedRedis.del(key);
    } else {
      await scopedRedis.setEx(key, ttl || DEFAULT_TTL, serializedData);
    }
  } catch (e) {
    if (signal.aborted) {
      cacheMetrics.recordTimeout({ layer: 'command' });
      return;
    }

    logger.error('CACHE: error setting to Redis', { error: e });
    cacheMetrics.recordError('set');
  }
};
