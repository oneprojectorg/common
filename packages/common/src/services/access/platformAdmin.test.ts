import { beforeEach, describe, expect, it, vi } from 'vitest';

// Unit test for the platform-admin flag reads. `@op/db/client` pulls in
// `server-only`, which Vitest can't load, so the query builder is faked: the
// service only needs `select(...).from(...).where(...).limit(...)` to resolve.

/** Rows the next `db.select(...)` chain resolves to, in call order. */
const selectQueue: unknown[][] = [];

const awaitableRows = (rows: unknown[]) =>
  Object.assign(Promise.resolve(rows), {
    limit: () => Promise.resolve(rows),
  });

vi.mock('@op/db/client', () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({ where: () => awaitableRows(selectQueue.shift() ?? []) }),
    })),
  },
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
}));

/** Every `cache()` call the service made, in order. */
const cacheCalls: Array<{ params?: unknown; options?: unknown }> = [];

vi.mock('@op/cache', () => ({
  // Pass-through, but record the call: the short TTL and the fact that the
  // authorization read does not cache at all are both asserted here, because
  // nothing else can invalidate a `platformAdmin` entry.
  cache: ({
    fetch,
    params,
    options,
  }: {
    fetch: () => Promise<unknown>;
    params?: unknown;
    options?: unknown;
  }) => {
    cacheCalls.push({ params, options });
    return fetch();
  },
}));

import { ValidationError } from '../../utils/error';
import {
  PLATFORM_ADMIN_CACHE_TTL_MS,
  isPlatformAdmin,
  isPlatformAdminCached,
} from './platformAdmin';

const TARGET = '00000000-0000-4000-a000-0000000000b2';

beforeEach(() => {
  selectQueue.length = 0;
  cacheCalls.length = 0;
});

describe('isPlatformAdmin', () => {
  it('reads the flag off the users row', async () => {
    selectQueue.push([{ isPlatformAdmin: true }]);
    await expect(isPlatformAdmin({ authUserId: TARGET })).resolves.toBe(true);
  });

  it('is false for a user without the flag', async () => {
    selectQueue.push([{ isPlatformAdmin: false }]);
    await expect(isPlatformAdmin({ authUserId: TARGET })).resolves.toBe(false);
  });

  it('is false when there is no users row', async () => {
    selectQueue.push([]);
    await expect(isPlatformAdmin({ authUserId: TARGET })).resolves.toBe(false);
  });

  it('rejects an auth user id that is not a UUID', async () => {
    await expect(isPlatformAdmin({ authUserId: 'nope' })).rejects.toThrow(
      ValidationError,
    );
  });

  // The authorization gate. A cache entry nothing can invalidate must never be
  // able to admit a revoked admin, so this read goes to the row every time.
  it('does not cache', async () => {
    selectQueue.push([{ isPlatformAdmin: true }]);
    await isPlatformAdmin({ authUserId: TARGET });

    expect(cacheCalls).toEqual([]);
  });
});

describe('isPlatformAdminCached', () => {
  it('returns the flag', async () => {
    selectQueue.push([{ isPlatformAdmin: true }]);
    await expect(isPlatformAdminCached({ authUserId: TARGET })).resolves.toBe(
      true,
    );
  });

  it('caches for the short TTL, not the 72h default', async () => {
    selectQueue.push([{ isPlatformAdmin: true }]);
    await isPlatformAdminCached({ authUserId: TARGET });

    expect(PLATFORM_ADMIN_CACHE_TTL_MS).toBe(5 * 60 * 1000);
    expect(cacheCalls).toEqual([
      { params: [TARGET], options: { ttl: PLATFORM_ADMIN_CACHE_TTL_MS } },
    ]);
  });

  it('canonicalises the id so casing cannot split the cache key', async () => {
    selectQueue.push([{ isPlatformAdmin: true }]);
    await isPlatformAdminCached({ authUserId: TARGET.toUpperCase() });

    expect(cacheCalls[0]?.params).toEqual([TARGET]);
  });
});
