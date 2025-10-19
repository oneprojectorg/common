import { OPURLConfig } from '@op/core';
import { logger as log } from '@op/logging';
import { waitUntil } from '@vercel/functions';
import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL;

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
    log.error('Redis Client Error', err);
  });

  // Connect to Redis
  if (!redis.isOpen) {
    redis.connect().catch(console.error);
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
  profile: 'profile',
};

const getCacheKey = (
  type: keyof typeof TypeMap,
  appKey: string = 'common',
  params: Array<string>,
) => {
  const apiVersion = OPURLConfig('API').IS_PRODUCTION ? 'v1' : 'dev/v1';
  const key = TypeMap[type];
  const [fullSlug, ...otherParams] = params;

  // this matches the ability to disregard full paths so pages can be moved without a 404
  const slug = fullSlug?.split('/').slice(-1)[0] ?? '';
  return `${apiVersion}/${appKey}/${key}/${slug}${
    otherParams?.length ? `:${otherParams.join(':')}` : ''
  }`;
};

const memCache = new Map();
const MEMCACHE_EXPIRE = 2 * 60 * 1000;

/*
 * Caches values into a tiered structure of memcache, KV cache, and ultimately a call to the DB
 */
export const cache = async <T = any>({
  type,
  appKey,
  params = [],
  fetch,
  options = {},
}: {
  type: keyof typeof TypeMap;
  appKey?: string;
  params?: any[];
  fetch: () => Promise<any>;
  options?: {
    skipMemCache?: boolean;
    storeNulls?: boolean;
    ttl?: number;
  };
}): Promise<T> => {
  const cacheKey = getCacheKey(type, appKey, params);
  const { ttl, skipMemCache = false, storeNulls = false } = options;

  // try memcache first
  if (!skipMemCache && memCache.has(cacheKey)) {
    const cachedVal = memCache.get(cacheKey);

    const memCacheExpire = ttl ? ttl : MEMCACHE_EXPIRE;
    if (Date.now() - cachedVal.createdAt < memCacheExpire) {
      log.info('CACHE: memory');
      return cachedVal.data;
    }
  }

  if (skipMemCache) {
    console.log('skipping memcache');
  }

  // fall back to Redis cache

  // set null if we don't get a response fast enough
  const timeout = new Promise((resolve) => {
    setTimeout(() => resolve(null), 300);
  });

  const data = (await Promise.race([get(cacheKey), timeout])) as T;

  if (data) {
    log.info('CACHE: KV');
    memCache.set(cacheKey, { createdAt: Date.now(), data });
    return data as T;
  }

  // finally retrieve the data from the DB
  const newData = await fetch();
  log.info('CACHE: no-cache');
  if (newData) {
    memCache.set(cacheKey, { createdAt: Date.now(), data: newData });
    // don't cache if we couldn't find the record (?)
    // TTL in redis is in seconds
    waitUntil(set(cacheKey, newData, ttl ? ttl / 1000 : 72 * 60 * 60)); // 72h default cache
  } else if (storeNulls) {
    // This allows us to store negative values in the memcache to improve rejections as well (and avoid DB calls for repeated rejections)
    memCache.set(cacheKey, { createdAt: Date.now(), data: null });
  }

  return newData as T;
};

export const invalidate = async ({
  type,
  appKey,
  params,
  data,
}: {
  type: keyof typeof TypeMap;
  appKey?: string;
  params: any[];
  data?: any; // Updates the data rather than invalidating it
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
  paramsList: any[][];
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
  if (!redis) {
    return null;
  }

  try {
    const data = await redis.get(key);

    if (data) {
      return JSON.parse(data);
    }

    return null;
  } catch (e) {
    log.error('CACHE: error getting from Redis', { error: e });

    return null;
  }
};

// const DEFAULT_TTL = 3600 * 24 * 30; // 3600 * 24 = 1 day
const DEFAULT_TTL = 3600; // short TTL for testing
export const set = async (key: string, data: any, ttl?: number) => {
  if (!redis) {
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
    log.error('CACHE: error setting to Redis', { error: e });
  }
};
