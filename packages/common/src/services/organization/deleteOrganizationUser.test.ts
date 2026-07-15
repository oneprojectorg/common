import { invalidate } from '@op/cache';
import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getOrgAccessUser, orgUserCacheKey } from '../access';
import { assertOrgAccess } from '../assert';
import { deleteOrganizationUser } from './deleteOrganizationUser';

vi.mock('@op/cache', () => ({
  invalidate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@op/db/client', () => ({
  db: {
    query: { organizationUsers: { findFirst: vi.fn() } },
    delete: vi.fn(),
  },
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
}));

vi.mock('@op/db/schema', () => ({
  organizationUsers: { id: 'id', organizationId: 'organizationId' },
}));

vi.mock('../assert', () => ({
  assertOrgAccess: vi.fn(),
}));

vi.mock('../access', async () => {
  const actual = await vi.importActual<typeof import('../access')>('../access');
  return {
    ...actual,
    getOrgAccessUser: Object.assign(vi.fn(), {
      invalidate: vi.fn(),
      invalidateAll: vi.fn(),
    }),
  };
});

const CALLER_AUTH_USER_ID = 'caller-auth-id';
const TARGET_AUTH_USER_ID = 'target-auth-id';
const ORG_ID = 'org-1';
const ORG_USER_ID = 'org-user-1';

const caller = { id: CALLER_AUTH_USER_ID } as User;

const buildDeleteChain = () => {
  const returning = vi
    .fn()
    .mockResolvedValue([{ id: ORG_USER_ID, authUserId: TARGET_AUTH_USER_ID }]);
  const where = vi.fn(() => ({ returning }));
  const del = vi.fn(() => ({ where }));
  return del;
};

describe('deleteOrganizationUser cache invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assertOrgAccess).mockResolvedValue(
      {} as Awaited<ReturnType<typeof assertOrgAccess>>,
    );
    vi.mocked(db.query.organizationUsers.findFirst).mockResolvedValue({
      id: ORG_USER_ID,
      organizationId: ORG_ID,
      authUserId: TARGET_AUTH_USER_ID,
    } as Awaited<ReturnType<typeof db.query.organizationUsers.findFirst>>);
    vi.mocked(db.delete).mockImplementation(
      buildDeleteChain() as unknown as typeof db.delete,
    );
  });

  it('invalidates the durable cache for the TARGET user, not the caller', async () => {
    await deleteOrganizationUser({
      organizationUserId: ORG_USER_ID,
      organizationId: ORG_ID,
      user: caller,
    });

    expect(invalidate).toHaveBeenCalledWith({
      type: 'orgUser',
      params: orgUserCacheKey({
        user: { id: TARGET_AUTH_USER_ID },
        organizationId: ORG_ID,
      }),
    });

    expect(invalidate).not.toHaveBeenCalledWith({
      type: 'orgUser',
      params: orgUserCacheKey({ user: caller, organizationId: ORG_ID }),
    });
  });

  it('invalidates the request-scoped memo for the TARGET user, not the caller', async () => {
    await deleteOrganizationUser({
      organizationUserId: ORG_USER_ID,
      organizationId: ORG_ID,
      user: caller,
    });

    expect(getOrgAccessUser.invalidate).toHaveBeenCalledWith({
      user: { id: TARGET_AUTH_USER_ID },
      organizationId: ORG_ID,
    });

    expect(getOrgAccessUser.invalidate).not.toHaveBeenCalledWith({
      user: caller,
      organizationId: ORG_ID,
    });
  });
});
