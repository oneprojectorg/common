import type { Counter } from '@op/logging';
import { metrics } from '@op/logging';

export type CacheHitSource = 'memory' | 'kv';
type SourceType = 'redis';

let cacheHitCounter: Counter | null = null;
let cacheMissCounter: Counter | null = null;
let cacheTimeoutCounter: Counter | null = null;
let cacheErrorCounter: Counter | null = null;

function getHitCounter() {
  if (!cacheHitCounter) {
    const meter = metrics.getMeter('cache');
    cacheHitCounter = meter.createCounter('cache.hits', {
      description: 'Number of cache hits by source',
      unit: '1',
    });
  }
  return cacheHitCounter;
}

function getMissCounter() {
  if (!cacheMissCounter) {
    const meter = metrics.getMeter('cache');
    cacheMissCounter = meter.createCounter('cache.misses', {
      description: 'Number of cache misses',
      unit: '1',
    });
  }
  return cacheMissCounter;
}

function getTimeoutCounter() {
  if (!cacheTimeoutCounter) {
    const meter = metrics.getMeter('cache');
    cacheTimeoutCounter = meter.createCounter('cache.timeouts', {
      description:
        'Number of cache fetches that fell through to the source because the cache layer was too slow. Split from cache.misses so a Redis slowdown does not masquerade as a cold cache.',
      unit: '1',
    });
  }
  return cacheTimeoutCounter;
}

function getErrorCounter() {
  if (!cacheErrorCounter) {
    const meter = metrics.getMeter('cache');
    cacheErrorCounter = meter.createCounter('cache.errors', {
      description: 'Number of cache errors by operation',
      unit: '1',
    });
  }
  return cacheErrorCounter;
}

export const cacheMetrics = {
  recordHit({
    type,
    source,
    keyType,
  }: {
    type: CacheHitSource;
    source?: SourceType;
    keyType?: string;
  }) {
    getHitCounter().add(1, {
      type,
      ...(source && { source }),
      ...(keyType && { keyType }),
    });
  },

  recordMiss(type?: string) {
    getMissCounter().add(1, {
      ...(type && { type }),
    });
  },

  recordTimeout({
    layer,
    keyType,
  }: {
    // `command` = the per-command Redis socket timeout (commands fail fast).
    // `race`    = the outer Promise.race timeout in `cache()` (Redis was
    //             slow enough that we gave up waiting and fell to the source).
    layer: 'command' | 'race';
    keyType?: string;
  }) {
    getTimeoutCounter().add(1, {
      source: 'redis',
      layer,
      ...(keyType && { keyType }),
    });
  },

  recordError(operation: 'get' | 'set', type?: string) {
    getErrorCounter().add(1, {
      operation,
      ...(type && { type }),
    });
  },
};
