import { logger as log } from '@op/logging';
import { waitUntil } from '@vercel/functions';
import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Create Redis client
const redis = createClient({
  url: REDIS_URL,
});

redis.on('error', (err) => {
  log.error('Redis Client Error', err);
});

// Connect to Redis
if (!redis.isOpen) {
  redis.connect().catch(console.error);
}

const TypeMap = {
  organization: 'org',
};

const getCacheKey = (
  type: keyof typeof TypeMap,
  siteKey: string,
  params: Array<string>,
) => {
  const apiVersion = 'v1';
  const key = TypeMap[type];
  const [fullSlug, ...otherParams] = params;

  // this matches the ability to disregard full paths so pages can be moved without a 404
  const slug = fullSlug?.split('/').slice(-1)[0] ?? '';
  return `${apiVersion}/${siteKey}/${key}/${slug}${
    otherParams?.length ? `:${otherParams.join(':')}` : ''
  }`;
};

const memCache = new Map();
const MEMCACHE_EXPIRE = 60 * 1000;

export const cache = async <T = any>({
  type,
  siteKey,
  params = [],
  fetch,
}: {
  type: keyof typeof TypeMap;
  siteKey: string;
  params?: any[];
  fetch: () => Promise<any>;
}): Promise<T> => {
  const cacheKey = getCacheKey(type, siteKey, params);

  // try memcache first
  if (memCache.has(cacheKey)) {
    const cachedVal = memCache.get(cacheKey);
    if (Date.now() - cachedVal.createdAt < MEMCACHE_EXPIRE) {
      log.info('CACHE: memory');
      return cachedVal.data;
    }
  }

  // fall back to Redis cache
  const data = (await get(cacheKey)) as T;

  if (data) {
    log.info('CACHE: Redis');
    memCache.set(cacheKey, { createdAt: Date.now(), data });
    return data as T;
  }

  // finally retrieve the data from the DB
  const newData = await fetch();
  log.info('CACHE: no-cache');
  if (newData) {
    memCache.set(cacheKey, { createdAt: Date.now(), data: newData });
    // don't cache if we couldn't find the record (?)
    waitUntil(set(cacheKey, newData));
  }

  return newData as T;
};

export const invalidate = async ({
  type,
  siteKey,
  params,
  data,
}: {
  type: keyof typeof TypeMap;
  siteKey: string;
  params: any[];
  data?: any;
}) => {
  const cacheKey = getCacheKey(type, siteKey, params);

  if (data) {
    memCache.set(cacheKey, { createdAt: Date.now(), data });
    set(cacheKey, data);
  } else {
    memCache.delete(cacheKey);
    set(cacheKey, null, 1000);
  }
};

// REDIS
const get = async (key: string) => {
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

const DEFAULT_TTL = 3600 * 24 * 30;
const set = async (key: string, data: any, ttl?: number) => {
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
