import { beforeEach, describe, expect, it, vi } from 'vitest';

// Unit test for the platform-admin flag service. `@op/db/client` pulls in
// `server-only`, which Vitest can't load, so the query builder is faked: the
// service only needs `select(...).from(...).where(...)` (optionally `.limit`)
// and `update(...).set(...).where(...).returning()` to resolve.

/** Rows the next `db.select(...)` chain resolves to, in call order. */
const selectQueue: unknown[][] = [];
/** Rows the next `db.update(...).returning()` resolves to. */
const updateQueue: unknown[][] = [];
const setCalls: unknown[] = [];

const awaitableRows = (rows: unknown[]) =>
  Object.assign(Promise.resolve(rows), {
    limit: () => Promise.resolve(rows),
  });

vi.mock('@op/db/client', () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({ where: () => awaitableRows(selectQueue.shift() ?? []) }),
    })),
    update: vi.fn(() => ({
      set: (values: unknown) => {
        setCalls.push(values);
        return {
          where: () => ({
            returning: () => Promise.resolve(updateQueue.shift() ?? []),
          }),
        };
      },
    })),
  },
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  ne: vi.fn((...args: unknown[]) => ({ op: 'ne', args })),
  count: vi.fn(() => ({ op: 'count' })),
}));

const invalidate = vi.fn();

vi.mock('@op/cache', () => ({
  // Pass-through: caching behaviour is @op/cache's own test's business.
  cache: ({ fetch }: { fetch: () => Promise<unknown> }) => fetch(),
  invalidate: (args: unknown) => invalidate(args),
}));

vi.mock('@op/logging', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils/error';
import {
  isPlatformAdmin,
  invalidatePlatformAdminCache,
  setPlatformAdmin,
} from './platformAdmin';

const ACTOR = '00000000-0000-4000-a000-0000000000a1';
const TARGET = '00000000-0000-4000-a000-0000000000b2';

beforeEach(() => {
  selectQueue.length = 0;
  updateQueue.length = 0;
  setCalls.length = 0;
  invalidate.mockClear();
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
});

describe('invalidatePlatformAdminCache', () => {
  it('drops both the platformAdmin and the user entry', async () => {
    await invalidatePlatformAdminCache({ authUserId: TARGET });

    expect(invalidate).toHaveBeenCalledWith({
      type: 'platformAdmin',
      params: [TARGET],
    });
    expect(invalidate).toHaveBeenCalledWith({
      type: 'user',
      params: [TARGET],
    });
  });
});

describe('setPlatformAdmin', () => {
  it('grants the flag and invalidates the caches', async () => {
    selectQueue.push([{ isPlatformAdmin: false }]);
    updateQueue.push([{ authUserId: TARGET, isPlatformAdmin: true }]);

    const updated = await setPlatformAdmin({
      targetAuthUserId: TARGET,
      isPlatformAdmin: true,
      actorAuthUserId: ACTOR,
    });

    expect(updated).toMatchObject({ isPlatformAdmin: true });
    expect(setCalls).toEqual([{ isPlatformAdmin: true }]);
    expect(invalidate).toHaveBeenCalledWith({
      type: 'platformAdmin',
      params: [TARGET],
    });
    expect(invalidate).toHaveBeenCalledWith({ type: 'user', params: [TARGET] });
  });

  it('revokes the flag while another admin remains', async () => {
    selectQueue.push([{ isPlatformAdmin: true }]);
    selectQueue.push([{ value: 2 }]);
    updateQueue.push([{ authUserId: TARGET, isPlatformAdmin: false }]);

    const updated = await setPlatformAdmin({
      targetAuthUserId: TARGET,
      isPlatformAdmin: false,
      actorAuthUserId: ACTOR,
    });

    expect(updated).toMatchObject({ isPlatformAdmin: false });
    expect(setCalls).toEqual([{ isPlatformAdmin: false }]);
  });

  it('refuses to change the actor’s own flag', async () => {
    await expect(
      setPlatformAdmin({
        targetAuthUserId: ACTOR,
        isPlatformAdmin: false,
        actorAuthUserId: ACTOR,
      }),
    ).rejects.toThrow(UnauthorizedError);

    expect(setCalls).toEqual([]);
  });

  it('refuses to revoke the last remaining platform admin', async () => {
    selectQueue.push([{ isPlatformAdmin: true }]);
    selectQueue.push([{ value: 0 }]);

    await expect(
      setPlatformAdmin({
        targetAuthUserId: TARGET,
        isPlatformAdmin: false,
        actorAuthUserId: ACTOR,
      }),
    ).rejects.toThrow(UnauthorizedError);

    expect(setCalls).toEqual([]);
  });

  it('does not run the last-admin guard when the target is already not an admin', async () => {
    selectQueue.push([{ isPlatformAdmin: false }]);
    updateQueue.push([{ authUserId: TARGET, isPlatformAdmin: false }]);

    await expect(
      setPlatformAdmin({
        targetAuthUserId: TARGET,
        isPlatformAdmin: false,
        actorAuthUserId: ACTOR,
      }),
    ).resolves.toMatchObject({ isPlatformAdmin: false });
  });

  it('throws NotFoundError when there is no users row to update', async () => {
    selectQueue.push([{ isPlatformAdmin: false }]);
    updateQueue.push([]);

    await expect(
      setPlatformAdmin({
        targetAuthUserId: TARGET,
        isPlatformAdmin: true,
        actorAuthUserId: ACTOR,
      }),
    ).rejects.toThrow(NotFoundError);
  });
});
