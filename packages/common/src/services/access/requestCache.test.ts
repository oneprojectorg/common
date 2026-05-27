import { describe, expect, it, vi } from 'vitest';

import { memoize, runWithRequestCache } from './requestCache';

describe('memoize / requestCache', () => {
  describe('isolation between requests', () => {
    it('does not leak entries across separate runWithRequestCache scopes', async () => {
      const fetcher = vi.fn(async (_id: string) => 'value');
      const memoFetcher = memoize(fetcher);

      await runWithRequestCache(async () => {
        await memoFetcher('k');
        await memoFetcher('k');
      });

      await runWithRequestCache(async () => {
        await memoFetcher('k');
      });

      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('isolates concurrent requests with the same key', async () => {
      const fetcherA = vi.fn(async () => 'A');
      const fetcherB = vi.fn(async () => 'B');
      const memoA = memoize(fetcherA);
      const memoB = memoize(fetcherB);

      await Promise.all([
        runWithRequestCache(async () => {
          expect(await memoA('shared')).toBe('A');
          expect(await memoA('shared')).toBe('A');
        }),
        runWithRequestCache(async () => {
          expect(await memoB('shared')).toBe('B');
          expect(await memoB('shared')).toBe('B');
        }),
      ]);

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
      const memoFetcher = memoize(fetcher);

      await runWithRequestCache(async () => {
        await expect(memoFetcher('k')).rejects.toThrow('transient');
        expect(await memoFetcher('k')).toBe('ok');
      });

      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('does not let a poisoned rejected promise leak to other keys', async () => {
      const fetcher = vi.fn(async (key: string) => {
        if (key === 'bad') {
          throw new Error('bad key');
        }
        return `value-${key}`;
      });
      const memoFetcher = memoize(fetcher);

      await runWithRequestCache(async () => {
        await expect(memoFetcher('bad')).rejects.toThrow('bad key');
        expect(await memoFetcher('good')).toBe('value-good');
      });
    });

    it('shares the in-flight rejection but allows later retries', async () => {
      const fetcher = vi
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce('recovered');
      const memoFetcher = memoize(fetcher);

      await runWithRequestCache(async () => {
        const [r1, r2] = await Promise.allSettled([
          memoFetcher('k'),
          memoFetcher('k'),
        ]);
        expect(r1.status).toBe('rejected');
        expect(r2.status).toBe('rejected');
        expect(fetcher).toHaveBeenCalledTimes(1);

        expect(await memoFetcher('k')).toBe('recovered');
        expect(fetcher).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('key derivation', () => {
    it('uses the keyFn to dedupe across differently-shaped args with the same identity', async () => {
      const fetcher = vi.fn(
        async (_args: {
          user: { id: string; extra?: string };
          profileId: string;
        }) => 'v',
      );
      const memoFetcher = memoize(
        fetcher,
        ({ user, profileId }) => `${user.id}:${profileId}`,
      );

      await runWithRequestCache(async () => {
        await memoFetcher({ user: { id: 'u1' }, profileId: 'p1' });
        // Different shape (extra field), same identity → should be a cache hit
        await memoFetcher({
          user: { id: 'u1', extra: 'unrelated' },
          profileId: 'p1',
        });
      });

      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('default keyFn stable-stringifies args (order-insensitive for object keys)', async () => {
      const fetcher = vi.fn(async (_args: Record<string, string>) => 'v');
      const memoFetcher = memoize(fetcher);

      await runWithRequestCache(async () => {
        await memoFetcher({ a: '1', b: '2' });
        // Different key order, same values
        await memoFetcher({ b: '2', a: '1' });
      });

      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('distinct keys do not collide', async () => {
      const fetcher = vi.fn(async (id: string) => `value-${id}`);
      const memoFetcher = memoize(fetcher);

      await runWithRequestCache(async () => {
        expect(await memoFetcher('a')).toBe('value-a');
        expect(await memoFetcher('b')).toBe('value-b');
      });
    });

    it('different memoize instances are isolated even with identical keyFns', async () => {
      const fA = vi.fn(async () => 'A');
      const fB = vi.fn(async () => 'B');
      const memoA = memoize(fA, () => 'k');
      const memoB = memoize(fB, () => 'k');

      await runWithRequestCache(async () => {
        expect(await memoA()).toBe('A');
        expect(await memoB()).toBe('B');
      });

      expect(fA).toHaveBeenCalledTimes(1);
      expect(fB).toHaveBeenCalledTimes(1);
    });
  });

  describe('invalidate', () => {
    it('invalidate(args) drops the entry for that key and refetches next time', async () => {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce('v1')
        .mockResolvedValueOnce('v2');
      const memoFetcher = memoize(fetcher);

      await runWithRequestCache(async () => {
        expect(await memoFetcher('k')).toBe('v1');
        memoFetcher.invalidate('k');
        expect(await memoFetcher('k')).toBe('v2');
      });
    });

    it('invalidate only drops matching keys', async () => {
      const fetcher = vi.fn(async (id: string) => `v-${id}`);
      const memoFetcher = memoize(fetcher);

      await runWithRequestCache(async () => {
        await memoFetcher('a');
        await memoFetcher('b');
        memoFetcher.invalidate('a');
        await memoFetcher('a'); // refetch
        await memoFetcher('b'); // cached
      });

      expect(fetcher).toHaveBeenCalledTimes(3);
    });

    it('invalidateAll clears every entry for the memoized fn', async () => {
      const fetcher = vi.fn(async (id: string) => `v-${id}`);
      const memoFetcher = memoize(fetcher);

      await runWithRequestCache(async () => {
        await memoFetcher('a');
        await memoFetcher('b');
        memoFetcher.invalidateAll();
        await memoFetcher('a');
        await memoFetcher('b');
      });

      expect(fetcher).toHaveBeenCalledTimes(4);
    });

    it('invalidate and invalidateAll are no-ops outside a scope', () => {
      const memoFetcher = memoize(async () => 'x');
      expect(() => memoFetcher.invalidate()).not.toThrow();
      expect(() => memoFetcher.invalidateAll()).not.toThrow();
    });
  });

  describe('out-of-scope behavior', () => {
    it('runs the fetcher every call when not inside runWithRequestCache', async () => {
      const fetcher = vi.fn(async () => 'x');
      const memoFetcher = memoize(fetcher);

      await memoFetcher();
      await memoFetcher();
      expect(fetcher).toHaveBeenCalledTimes(2);
    });
  });
});
