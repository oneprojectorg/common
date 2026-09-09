import { beforeEach, describe, expect, it, vi } from 'vitest';

// `@op/db/client` pulls in `server-only`, which Vitest can't load, so the query
// builder is faked.
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

import { ValidationError } from '../../utils/error';
import { isPlatformAdmin } from './platformAdmin';

const AUTH_USER_ID = '00000000-0000-4000-a000-0000000000b2';

beforeEach(() => {
  selectQueue.length = 0;
});

describe('isPlatformAdmin', () => {
  it('is true when the flag is set', async () => {
    selectQueue.push([{ isPlatformAdmin: true }]);
    await expect(isPlatformAdmin({ authUserId: AUTH_USER_ID })).resolves.toBe(
      true,
    );
  });

  it('is false when the flag is not set', async () => {
    selectQueue.push([{ isPlatformAdmin: false }]);
    await expect(isPlatformAdmin({ authUserId: AUTH_USER_ID })).resolves.toBe(
      false,
    );
  });

  it('is false when there is no users row', async () => {
    selectQueue.push([]);
    await expect(isPlatformAdmin({ authUserId: AUTH_USER_ID })).resolves.toBe(
      false,
    );
  });

  it('rejects an auth user id that is not a UUID', async () => {
    await expect(isPlatformAdmin({ authUserId: 'nope' })).rejects.toThrow(
      ValidationError,
    );
  });
});
