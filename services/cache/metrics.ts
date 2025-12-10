import type { Counter } from '@opentelemetry/api';

import { metrics } from '@op/logging';

export type CacheSource = 'memory' | 'kv' | 'no-cache';

let cacheHitCounter: Counter | null = null;
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
  recordHit(source: CacheSource, type?: string) {
    getHitCounter().add(1, {
      source,
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
