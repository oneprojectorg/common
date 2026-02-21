import { OPURLConfig } from '@op/core';
import { logger } from '@op/logging';
import { waitUntil } from '@vercel/functions';
import { createClient } from 'redis';

import { cacheMetrics } from './metrics';

const REDIS_URL = process.env.REDIS_URL;

// Create Redis client only if REDIS_URL is provided
let redis: ReturnType<typeof createClient> | null = null;

/** Tracks whether Redis is currently reachable — used to suppress per-request error spam. */
let redisAvailable = false;

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

  // Log state transitions once instead of every error event
  redis.on('error', () => {
    if (redisAvailable) {
      redisAvailable = false;
      logger.warn(
        'Redis connection lost — cache operations will fall through to DB',
      );
    }
  });

  redis.on('ready', () => {
    if (!redisAvailable) {
      redisAvailable = true;
      logger.info('Redis connected');
    }
  });

  // Connect to Redis
  if (!redis.isOpen) {
    redis.connect().catch(() => {
      // Intentionally swallowed — the 'error' event handler above already
      // logs the transition to unavailable state once.
    });
  }
}

const TypeMap = {
  search: 'search',
  geonames: 'geonames',
  organization: 'org',
  allowList: 'allowList',
  linkPreview: 'linkPreview',
  user: 'user',
  orgUser: 'orgUser',
  profileUser: 'profileUser',
  profile: 'profile',
  decision: 'decision',
};

/** Allowed types for cache params - will be stringified for key generation */
type CacheParam = string | number | boolean | undefined | null | string[];
type CacheParams = CacheParam[];

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

  // this matches the ability to disregard full paths so pages can be moved without a 404
  const slug = fullSlug?.split('/').slice(-1)[0] ?? '';
  return `${apiVersion}/${resolvedAppKey}/${key}/${slug}${
    otherParams?.length ? `:${otherParams.join(':')}` : ''
  }`;
};

// TODO: replace with something like an LRU cache
const memCache = new Map<string, { createdAt: number; data: unknown }>();
const MEMCACHE_EXPIRE = 2 * 60 * 1000;

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

  // try memcache first
  const cachedVal = !skipMemCache ? memCache.get(cacheKey) : undefined;
  if (cachedVal) {
    const memCacheExpire = ttl ? ttl : MEMCACHE_EXPIRE;
    if (Date.now() - cachedVal.createdAt < memCacheExpire) {
      cacheMetrics.recordHit({ type: 'memory', keyType: type });
      return cachedVal.data as Awaited<T>;
    }
  }

  // fall back to Redis cache

  // set null if we don't get a response fast enough
  const timeout = new Promise((resolve) => {
    setTimeout(() => resolve(null), 300);
  });

  const data = (await Promise.race([get(cacheKey), timeout])) as Awaited<T>;

  if (data) {
    cacheMetrics.recordHit({ type: 'kv', source: 'redis', keyType: type });
    memCache.set(cacheKey, { createdAt: Date.now(), data });
    return data;
  }

  // finally retrieve the data from the DB
  const newData = await fetch();
  cacheMetrics.recordMiss(type);

  const shouldSkipCache = options.skipCacheWrite?.(newData) ?? false;

  if (newData && !shouldSkipCache) {
    memCache.set(cacheKey, { createdAt: Date.now(), data: newData });
    // don't cache if we couldn't find the record (?)
    // TTL in redis is in seconds
    waitUntil(set(cacheKey, newData, ttl ? ttl / 1000 : 72 * 60 * 60)); // 72h default cache
  } else if (storeNulls && !shouldSkipCache) {
    // This allows us to store negative values in the memcache to improve rejections as well (and avoid DB calls for repeated rejections)
    memCache.set(cacheKey, { createdAt: Date.now(), data: null });
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
    memCache.set(cacheKey, { createdAt: Date.now(), data });
    set(cacheKey, data);
  } else {
    memCache.delete(cacheKey);
    set(cacheKey, null, 1000);
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

export const get = async (key: string) => {
  if (!redis || !redisAvailable) {
    return null;
  }

  try {
    const data = await redis.get(key);

    if (data) {
      return JSON.parse(data);
    }

    return null;
  } catch (e) {
    cacheMetrics.recordError('get');

    return null;
  }
};

// const DEFAULT_TTL = 3600 * 24 * 30; // 3600 * 24 = 1 day
const DEFAULT_TTL = 3600; // short TTL for testing
export const set = async (key: string, data: unknown, ttl?: number) => {
  if (!redis || !redisAvailable) {
    return;
  }

  try {
    const serializedData = JSON.stringify(data);
    if (data === null) {
      await redis.del(key);
    } else {
      await redis.setEx(key, ttl || DEFAULT_TTL, serializedData);
    }
  } catch (e) {
    cacheMetrics.recordError('set');
  }
};
