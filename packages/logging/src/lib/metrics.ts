import { metrics } from '@opentelemetry/api';

export type CacheSource = 'memory' | 'kv' | 'no-cache';

const meter = metrics.getMeter('cache');

const cacheHitCounter = meter.createCounter('cache.hits', {
  description: 'Number of cache hits by source',
  unit: '1',
});

const cacheErrorCounter = meter.createCounter('cache.errors', {
  description: 'Number of cache errors by operation',
  unit: '1',
});

export const cacheMetrics = {
  recordHit(source: CacheSource, type?: string) {
    cacheHitCounter.add(1, {
      source,
      ...(type && { type }),
    });
  },

  recordError(operation: 'get' | 'set', type?: string) {
    cacheErrorCounter.add(1, {
      operation,
      ...(type && { type }),
    });
  },
};
