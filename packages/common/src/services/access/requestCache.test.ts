import { describe, expect, it, vi } from 'vitest';

import {
  invalidateRequest,
  memoRequest,
  runWithRequestCache,
} from './requestCache';

describe('requestCache', () => {
  describe('isolation between requests', () => {
    it('does not leak entries across separate runWithRequestCache scopes', async () => {
      const fetcher = vi.fn(async () => 'value');

      await runWithRequestCache(async () => {
        await memoRequest('k', fetcher);
        await memoRequest('k', fetcher);
      });

      await runWithRequestCache(async () => {
        await memoRequest('k', fetcher);
      });

      // first scope: 1 call (dedup); second scope: fresh fetch → 2 total
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('isolates concurrent requests', async () => {
      const seen: string[] = [];
      const fetcherA = vi.fn(async () => {
        seen.push('A');
        return 'A';
      });
      const fetcherB = vi.fn(async () => {
        seen.push('B');
        return 'B';
      });

      await Promise.all([
        runWithRequestCache(async () => {
          const v1 = await memoRequest('shared-key', fetcherA);
          const v2 = await memoRequest('shared-key', fetcherA);
          expect(v1).toBe('A');
          expect(v2).toBe('A');
        }),
        runWithRequestCache(async () => {
          const v1 = await memoRequest('shared-key', fetcherB);
          const v2 = await memoRequest('shared-key', fetcherB);
          expect(v1).toBe('B');
          expect(v2).toBe('B');
        }),
      ]);

      // Each scope dedups internally — should be 1 call each, NOT cross-contaminated
      expect(fetcherA).toHaveBeenCalledTimes(1);
      expect(fetcherB).toHaveBeenCalledTimes(1);
    });
  });

  describe('rejection handling (no poisoning)', () => {
    it('drops the entry when the fetcher rejects so the next caller retries', async () => {
      let attempt = 0;
      const fetcher = vi.fn(async () => {
        attempt += 1;
        if (attempt === 1) {
          throw new Error('transient');
        }
        return 'ok';
      });

      await runWithRequestCache(async () => {
        await expect(memoRequest('k', fetcher)).rejects.toThrow('transient');
        const value = await memoRequest('k', fetcher);
        expect(value).toBe('ok');
      });

      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('does not allow a poisoned rejected promise to be returned to other keys', async () => {
      const fetcher = vi.fn(async (key: string) => {
        if (key === 'bad') {
          throw new Error('bad key');
        }
        return `value-${key}`;
      });

      await runWithRequestCache(async () => {
        await expect(memoRequest('bad', () => fetcher('bad'))).rejects.toThrow(
          'bad key',
        );
        const good = await memoRequest('good', () => fetcher('good'));
        expect(good).toBe('value-good');
      });
    });

    it('shares the same in-flight rejection among concurrent callers but lets later ones retry', async () => {
      const fetcher = vi
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce('recovered');

      await runWithRequestCache(async () => {
        const [r1, r2] = await Promise.allSettled([
          memoRequest('k', fetcher),
          memoRequest('k', fetcher),
        ]);
        expect(r1.status).toBe('rejected');
        expect(r2.status).toBe('rejected');
        // Both concurrent callers should have received the same in-flight rejection
        expect(fetcher).toHaveBeenCalledTimes(1);

        const retry = await memoRequest('k', fetcher);
        expect(retry).toBe('recovered');
        expect(fetcher).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('key separation', () => {
    it('does not return one key’s value for another key', async () => {
      await runWithRequestCache(async () => {
        const a = await memoRequest('a', async () => 'value-a');
        const b = await memoRequest('b', async () => 'value-b');
        expect(a).toBe('value-a');
        expect(b).toBe('value-b');
      });
    });
  });

  describe('invalidation', () => {
    it('refetches after invalidateRequest by exact key', async () => {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce('v1')
        .mockResolvedValueOnce('v2');

      await runWithRequestCache(async () => {
        expect(await memoRequest('profileUser:p1:u1', fetcher)).toBe('v1');
        invalidateRequest('profileUser:p1:u1');
        expect(await memoRequest('profileUser:p1:u1', fetcher)).toBe('v2');
      });
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('only invalidates keys matching the prefix', async () => {
      const fetcher = vi.fn(async (k: string) => `v-${k}`);

      await runWithRequestCache(async () => {
        await memoRequest('profileUser:p1:u1', () =>
          fetcher('profileUser:p1:u1'),
        );
        await memoRequest('profileUser:p1:u2', () =>
          fetcher('profileUser:p1:u2'),
        );
        await memoRequest('orgUser:o1:u1', () => fetcher('orgUser:o1:u1'));

        invalidateRequest('profileUser:p1:u1');

        // Re-call all three: only p1:u1 should refetch
        await memoRequest('profileUser:p1:u1', () =>
          fetcher('profileUser:p1:u1'),
        );
        await memoRequest('profileUser:p1:u2', () =>
          fetcher('profileUser:p1:u2'),
        );
        await memoRequest('orgUser:o1:u1', () => fetcher('orgUser:o1:u1'));
      });

      // 3 initial + 1 refetch for p1:u1 = 4
      expect(fetcher).toHaveBeenCalledTimes(4);
    });
  });

  describe('out-of-scope behavior', () => {
    it('runs the fetcher every call when not inside runWithRequestCache', async () => {
      const fetcher = vi.fn(async () => 'x');
      await memoRequest('k', fetcher);
      await memoRequest('k', fetcher);
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('invalidateRequest is a no-op outside a scope', () => {
      expect(() => invalidateRequest('anything')).not.toThrow();
    });
  });
});
