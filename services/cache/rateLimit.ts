import { logger } from '@op/logging';
import { LRUCache } from 'lru-cache';
import type { createClient } from 'redis';

import { redisClient } from './redisClient';

export interface ConsumeSlidingWindowResult {
  /** True when the call MAY proceed; false when the bucket is full. */
  allowed: boolean;
  /** Total observed hits in the current window (including this attempt). */
  count: number;
  /** Milliseconds until the oldest in-window hit ages out. */
  resetMs: number;
}

interface ConsumeSlidingWindowOptions {
  /** Bucket identifier — caller is responsible for namespacing (e.g. by route). */
  key: string;
  /** Width of the sliding window, in milliseconds. */
  windowMs: number;
  /** Maximum hits allowed within the window. */
  maxRequests: number;
  /**
   * Override the wall-clock used to score entries. Tests pass a deterministic
   * clock; production calls leave this undefined and pick up `Date.now`.
   */
  now?: () => number;
}

const REDIS_COMMAND_TIMEOUT_MS = 100;

// LRU fallback bounds — sized so a process under sustained Redis outage does
// not leak memory the way the in-process Map this replaces did. The window
// log per key is at most `maxRequests` timestamps; the cache caps the number
// of distinct keys.
const FALLBACK_MAX_KEYS = 10_000;
const fallback = new LRUCache<string, number[]>({ max: FALLBACK_MAX_KEYS });

/**
 * Consume one hit against a sliding-window rate limiter.
 *
 * Backed by a Redis sorted set keyed at `key`: scores are arrival timestamps,
 * members are unique per hit so concurrent calls cannot collide. The four
 * operations (add, prune, count, expire) are pipelined so the round-trip
 * stays at one network hop. When Redis is unreachable or the round-trip
 * exceeds `REDIS_COMMAND_TIMEOUT_MS`, the limiter degrades to a bounded
 * in-process LRU — strictly more accurate than failing open, less accurate
 * than Redis.
 */
export const consumeSlidingWindow = async ({
  key,
  windowMs,
  maxRequests,
  now = Date.now,
}: ConsumeSlidingWindowOptions): Promise<ConsumeSlidingWindowResult> => {
  const ts = now();
  const cutoff = ts - windowMs;

  if (redisClient?.isOpen) {
    const result = await tryConsumeFromRedis({
      client: redisClient,
      key,
      ts,
      cutoff,
      windowMs,
    });
    if (result) {
      return finalize({ result, maxRequests, windowMs, ts });
    }
  }

  return finalize({
    result: consumeFromFallback({ key, ts, cutoff }),
    maxRequests,
    windowMs,
    ts,
  });
};

const tryConsumeFromRedis = async ({
  client,
  key,
  ts,
  cutoff,
  windowMs,
}: {
  client: NonNullable<ReturnType<typeof createClient>>;
  key: string;
  ts: number;
  cutoff: number;
  windowMs: number;
}): Promise<{ count: number; oldestScore: number | null } | null> => {
  const signal = AbortSignal.timeout(REDIS_COMMAND_TIMEOUT_MS);

  try {
    const scoped = client.withAbortSignal(signal);
    const member = `${ts}:${Math.random().toString(36).slice(2)}`;
    const replies = await scoped
      .multi()
      .zRemRangeByScore(key, 0, cutoff)
      .zAdd(key, { score: ts, value: member })
      .zCard(key)
      .pExpire(key, windowMs)
      .zRangeWithScores(key, 0, 0)
      .exec();

    const count = Number(replies[2] ?? 0);
    const oldestScore = extractOldestScore(replies[4]);

    return { count, oldestScore };
  } catch (error) {
    if (!signal.aborted) {
      logger.error('rateLimit: redis sliding-window failed', { error });
    }
    return null;
  }
};

// Pulls the numeric `score` out of `ZRANGE … WITHSCORES`'s first member,
// guarded so the caller never has to assert the shape of an `unknown` reply.
const extractOldestScore = (reply: unknown): number | null => {
  if (!Array.isArray(reply) || reply.length === 0) {
    return null;
  }
  const first = reply[0];
  if (
    typeof first === 'object' &&
    first !== null &&
    'score' in first &&
    typeof first.score === 'number'
  ) {
    return first.score;
  }
  return null;
};

const consumeFromFallback = ({
  key,
  ts,
  cutoff,
}: {
  key: string;
  ts: number;
  cutoff: number;
}): { count: number; oldestScore: number | null } => {
  const existing = fallback.get(key) ?? [];
  const pruned = existing.filter((entry) => entry > cutoff);
  pruned.push(ts);
  fallback.set(key, pruned);

  return {
    count: pruned.length,
    oldestScore: pruned[0] ?? null,
  };
};

const finalize = ({
  result: { count, oldestScore },
  maxRequests,
  windowMs,
  ts,
}: {
  result: { count: number; oldestScore: number | null };
  maxRequests: number;
  windowMs: number;
  ts: number;
}): ConsumeSlidingWindowResult => {
  const resetMs = oldestScore !== null ? oldestScore + windowMs - ts : windowMs;
  return {
    allowed: count <= maxRequests,
    count,
    resetMs: Math.max(0, resetMs),
  };
};
