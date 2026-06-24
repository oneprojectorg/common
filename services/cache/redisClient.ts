import { logger } from '@op/logging';
import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL;

/**
 * Shared Redis client for the cache workspace — used by both the tiered
 * KV cache and the rate-limit sliding window so a process opens at most
 * one connection rather than one per consumer.
 *
 * `null` when `REDIS_URL` is unset; callers degrade to an in-process
 * fallback in that case.
 */
export const redisClient: ReturnType<typeof createClient> | null = (() => {
  if (!REDIS_URL) {
    return null;
  }

  const client = createClient({
    url: REDIS_URL,
    disableOfflineQueue: true,
    socket: {
      connectTimeout: 10_000,
      keepAlive: false,
      reconnectStrategy: (retries) => {
        if (retries > 3) {
          return false;
        }

        const jitter = Math.floor(Math.random() * 100);

        return Math.min(retries * 500, 5_000) + jitter;
      },
    },
  });

  client.on('error', (err) => {
    logger.error('Redis Client Error', err);
  });

  if (!client.isOpen) {
    client.connect().catch(console.error);
  }

  return client;
})();
