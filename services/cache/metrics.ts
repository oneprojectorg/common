import type { Counter } from '@op/logging';
import { metrics } from '@op/logging';

export type CacheHitSource = 'memory' | 'kv';
type SourceType = 'redis';

let cacheHitCounter: Counter | null = null;
let cacheMissCounter: Counter | null = null;
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

  recordError(operation: 'get' | 'set', type?: string) {
    getErrorCounter().add(1, {
      operation,
      ...(type && { type }),
    });
  },
};
