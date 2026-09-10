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

// Per-command socket timeout for cache-only state (`getWithStatus` /
// `setWithStatus`). Ten times the bound above, because the trade is inverted.
// For a cache in front of a database a clipped command costs one re-fetch, so
// failing fast is free and 100ms is right. Where this is the only copy, a
// clipped command loses the record: a clipped read reports "could not read",
// and a clipped write leaves a finished job looking unfinished.
//
// These are also the largest values in the cache by some margin. A completed
// theme analysis carries two model passes and every proposal they cite —
// kilobytes, where a cached row runs to hundreds of bytes — and 100ms was never
// sized for writing that over TLS. A second is still an order of magnitude
// under any caller's own budget, and these callers issue one command per
// request rather than one per row.
const REDIS_STATE_COMMAND_TIMEOUT_MS = 1_000;

// Sentinel for `Promise.race` — distinguishes the race timeout from a
// legitimate `null` returned by Redis (cache miss).
const RACE_TIMEOUT: unique symbol = Symbol('cache.race-timeout');

// Discriminated result of an attempted Redis read. `cache()` uses it to
// record `hit` / `miss` / `timeout` separately so a Redis slowdown does
// not masquerade as a cold cache.
//
// `miss` means Redis answered and held nothing. `not-ready`, `timeout` and
// `error` mean Redis did not answer, which is a different claim. A caller that
// treats them as a miss states the key is absent, when it only knows it could
// not look. A caller that holds cache-only state needs that distinction. See
// `getWithStatus`.
export type RedisGetResult =
  | { status: 'hit'; data: unknown }
  | { status: 'miss' }
  | { status: 'not-ready' }
  | { status: 'timeout' }
  | { status: 'error' };

/**
 * What {@link getWithStatus} answers.
 *
 * `not-ready` is absent by construction: that function waits the client out and
 * reports one that stayed down as a `timeout`. So a `miss` from it carries the
 * guarantee its callers branch on — Redis answered, and held nothing.
 */
export type RedisStateGetResult = Exclude<
  RedisGetResult,
  { status: 'not-ready' }
>;

/**
 * Whether a write to cache-only state landed. See {@link setWithStatus}.
 *
 * `ok` means Redis acknowledged the command. Every other status means the value
 * is not stored, and says why: `unconfigured` is a deployment with no cache at
 * all, `not-ready` a client that never started accepting commands, `timeout` a
 * command that outran its socket bound, `error` one Redis refused.
 */
export type RedisSetResult =
  | { status: 'ok' }
  | { status: 'unconfigured' }
  | { status: 'not-ready' }
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
  } else if (raced.status === 'timeout' || raced.status === 'not-ready') {
    // Both mean Redis did not answer, which is what `cache.timeouts` carries.
    // Counting a client that never came up as a miss would report a connection
    // problem as a cold cache, on the one dashboard built to tell them apart.
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
/**
 * How long a caller that cannot tolerate a false answer waits for the client.
 *
 * Sized for a cold start rather than a reconnect: the client is created at
 * module load and `connect()` is deliberately not awaited, so the first request
 * a fresh serverless instance serves arrives while the socket is still coming
 * up. Two seconds covers that handshake and is still far below any caller's own
 * budget.
 */
const REDIS_READY_TIMEOUT_MS = 2_000;

/**
 * Waits, briefly, for the client to start accepting commands.
 *
 * `redis.connect()` is fired at module load and not awaited, so on a fresh
 * instance there is a window where the client exists and is not ready. Commands
 * issued in it fail — `disableOfflineQueue` means they are not held — and reads
 * in it report a miss. For a cache in front of a database that is the right
 * trade: answer "not cached", fetch from the source, move on.
 *
 * It is the wrong trade for cache-only state, where a miss is not a slower path
 * to the same answer but a different answer. Waiting out the handshake turns a
 * confident wrong reply into a correct one a moment later.
 *
 * Listens for `ready` rather than awaiting the connect promise, so it also
 * covers a client reconnecting after a drop.
 *
 * @returns Whether the client is accepting commands.
 */
const whenRedisReady = async (): Promise<boolean> => {
  const client = redis;

  if (!client) {
    return false;
  }

  if (client.isReady) {
    return true;
  }

  return await new Promise<boolean>((resolve) => {
    const settle = (ready: boolean) => {
      clearTimeout(timer);
      client.off('ready', onReady);
      resolve(ready);
    };
    const onReady = () => settle(true);
    // Re-reads `isReady` rather than resolving false outright: the event can
    // fire between the check above and the listener being attached.
    const timer = setTimeout(
      () => settle(client.isReady),
      REDIS_READY_TIMEOUT_MS,
    );

    client.once('ready', onReady);
  });
};

const tryGetFromRedis = async (
  key: string,
  timeoutMs: number = REDIS_COMMAND_TIMEOUT_MS,
): Promise<RedisGetResult> => {
  // No cache configured at all. This deployment can hold nothing, which
  // `cache()` reads as a miss and answers from the source. Reporting an error
  // instead would turn a deployment without Redis into one that answers 500.
  if (!redis) {
    return { status: 'miss' };
  }

  // A configured client that is not accepting commands: its own status, not a
  // miss. `miss` is a claim that the key is absent, and a caller holding
  // cache-only state acts on that claim by reporting a record that is still
  // there as gone.
  //
  // `getWithStatus` waits the client out before reaching here, so this is
  // either a deployment-wide connection problem or the client dropping between
  // that wait and this command. Both are "could not look".
  if (!redis.isReady) {
    return { status: 'not-ready' };
  }

  const signal = AbortSignal.timeout(timeoutMs);

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
 *
 * @param key - Key to read.
 * @returns A {@link RedisGetResult}. `hit` carries the parsed value. `miss` means
 *   Redis answered and held nothing, or this deployment has no working cache.
 *   `timeout` and `error` mean Redis did not answer, so absence is not known.
 */
export const getWithStatus = async (
  key: string,
): Promise<RedisStateGetResult> => {
  // The wait is here rather than in `tryGetFromRedis` so it costs only the
  // callers who need it. A cache in front of a database wants the fast miss and
  // its own fetch; these callers have no source to fall back to, so for them a
  // miss from a client that was never ready is a wrong answer, not a slow one.
  if (redis && !(await whenRedisReady())) {
    // Not `miss`. The client is configured and did not answer, which is the one
    // thing this function exists to keep separate from absence.
    cacheMetrics.recordTimeout({ layer: 'command' });

    return { status: 'timeout' };
  }

  const result = await tryGetFromRedis(key, REDIS_STATE_COMMAND_TIMEOUT_MS);

  // The client dropped between the wait above and the command. Reported as the
  // timeout it is, so a `miss` from here keeps meaning "Redis answered and held
  // nothing" — the guarantee this function exists to provide.
  if (result.status === 'not-ready') {
    cacheMetrics.recordTimeout({ layer: 'command' });

    return { status: 'timeout' };
  }

  return result;
};

// const DEFAULT_TTL = 3600 * 24 * 30; // 3600 * 24 = 1 day
const DEFAULT_TTL = 3600; // short TTL for testing

/**
 * Writes a key and reports what happened.
 *
 * Shared by {@link set} and {@link setWithStatus}, which differ only in what
 * they do with the answer and how long they let the command take.
 */
const tryWriteToRedis = async (
  key: string,
  data: unknown,
  ttl: number | undefined,
  timeoutMs: number,
): Promise<RedisSetResult> => {
  if (!redis) {
    return { status: 'unconfigured' };
  }

  // Same window as the read, and worse consequences. `disableOfflineQueue` means
  // a command issued before the client is ready is rejected rather than held, so
  // a write on a fresh instance was landing in the catch below and being logged
  // and dropped. For a cache that costs a repeat fetch; for cache-only state it
  // loses the record.
  if (!(await whenRedisReady())) {
    cacheMetrics.recordTimeout({ layer: 'command' });

    return { status: 'not-ready' };
  }

  const signal = AbortSignal.timeout(timeoutMs);

  try {
    const serializedData = JSON.stringify(data);
    const scopedRedis = redis.withAbortSignal(signal);
    if (data === null) {
      await scopedRedis.del(key);
    } else {
      await scopedRedis.setEx(key, ttl || DEFAULT_TTL, serializedData);
    }

    return { status: 'ok' };
  } catch (e) {
    if (signal.aborted) {
      cacheMetrics.recordTimeout({ layer: 'command' });

      return { status: 'timeout' };
    }

    logger.error('CACHE: error setting to Redis', { error: e });
    cacheMetrics.recordError('set');

    return { status: 'error' };
  }
};

export const set = async (key: string, data: unknown, ttl?: number) => {
  await tryWriteToRedis(key, data, ttl, REDIS_COMMAND_TIMEOUT_MS);
};

/**
 * Writes a key and reports whether the write landed.
 *
 * {@link set} discards that answer, which is right for a cache: a dropped write
 * costs the next reader one fetch from the source, and there is nothing useful
 * for the caller to do about it.
 *
 * It is wrong for state whose only copy is here. A dropped write there is not a
 * slower path to the same answer — the record simply does not say what the
 * caller believes it says, and every reader afterwards is told something false.
 * The one caller who can still fix that is the one who has the value in hand, so
 * this hands the failure back: a workflow step can fail and be retried by
 * Inngest, a request can report the error instead of claiming success.
 *
 * Allows the command ten times longer than {@link set} for the reasons on
 * {@link REDIS_STATE_COMMAND_TIMEOUT_MS} — these values are the largest we
 * store, and a clipped write of one is the failure this function exists to stop
 * being silent.
 *
 * @param key - Key to write.
 * @param data - Value to store. `null` deletes the key, as in {@link set}.
 * @param ttl - Expiry in seconds. Defaults to {@link DEFAULT_TTL}.
 * @returns A {@link RedisSetResult}. Anything but `ok` means the value is not
 *   stored.
 */
export const setWithStatus = async (
  key: string,
  data: unknown,
  ttl?: number,
): Promise<RedisSetResult> =>
  await tryWriteToRedis(key, data, ttl, REDIS_STATE_COMMAND_TIMEOUT_MS);
