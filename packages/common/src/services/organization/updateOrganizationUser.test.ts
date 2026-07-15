import { invalidate } from '@op/cache';
import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getOrgAccessUser, orgUserCacheKey } from '../access';
import { assertOrgAccess } from '../assert';
import { updateOrganizationUser } from './updateOrganizationUser';

vi.mock('@op/cache', () => ({
  invalidate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@op/db/client', () => ({
  db: {
    query: { organizationUsers: { findFirst: vi.fn() } },
    update: vi.fn(),
    delete: vi.fn(),
    insert: vi.fn(),
    select: vi.fn(),
  },
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  inArray: vi.fn((...args: unknown[]) => ({ op: 'inArray', args })),
}));

vi.mock('@op/db/schema', () => ({
  accessRoles: { id: 'id' },
  organizationUserToAccessRoles: { organizationUserId: 'organizationUserId' },
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

describe('updateOrganizationUser cache invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assertOrgAccess).mockResolvedValue(
      {} as Awaited<ReturnType<typeof assertOrgAccess>>,
    );

    // First call: lookup target. Second call: fetch updated row with roles.
    vi.mocked(db.query.organizationUsers.findFirst)
      .mockResolvedValueOnce({
        id: ORG_USER_ID,
        organizationId: ORG_ID,
        authUserId: TARGET_AUTH_USER_ID,
      } as Awaited<ReturnType<typeof db.query.organizationUsers.findFirst>>)
      .mockResolvedValueOnce({
        id: ORG_USER_ID,
        organizationId: ORG_ID,
        authUserId: TARGET_AUTH_USER_ID,
        roles: [],
      } as Awaited<ReturnType<typeof db.query.organizationUsers.findFirst>>);

    const setFn = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    vi.mocked(db.update).mockReturnValue({
      set: setFn,
    } as unknown as ReturnType<typeof db.update>);
  });

  it('invalidates the durable cache for the TARGET user, not the caller', async () => {
    await updateOrganizationUser({
      organizationUserId: ORG_USER_ID,
      organizationId: ORG_ID,
      data: { name: 'New name' },
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
    await updateOrganizationUser({
      organizationUserId: ORG_USER_ID,
      organizationId: ORG_ID,
      data: { name: 'New name' },
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
