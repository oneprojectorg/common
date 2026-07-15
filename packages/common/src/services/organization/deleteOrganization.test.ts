import { invalidate, invalidateMultiple } from '@op/cache';
import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getOrgAccessUser, orgUserCacheKey } from '../access';
import { assertOrgAccess } from '../assert';
import { deleteOrganization } from './deleteOrganization';

vi.mock('@op/cache', () => ({
  invalidate: vi.fn().mockResolvedValue(undefined),
  invalidateMultiple: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@op/db/client', () => ({
  db: {
    query: {
      organizations: { findFirst: vi.fn() },
      organizationUsers: { findMany: vi.fn() },
    },
    delete: vi.fn(),
  },
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
}));

vi.mock('@op/db/schema', () => ({
  profiles: { id: 'id' },
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
const ORG_ID = 'org-1';
const ORG_PROFILE_ID = 'org-profile-1';
const ORG_SLUG = 'org-slug';
const MEMBER_AUTH_USER_IDS = [CALLER_AUTH_USER_ID, 'member-a', 'member-b'];

const caller = { id: CALLER_AUTH_USER_ID } as User;

describe('deleteOrganization cache invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assertOrgAccess).mockResolvedValue(
      {} as Awaited<ReturnType<typeof assertOrgAccess>>,
    );
    vi.mocked(db.query.organizations.findFirst).mockResolvedValue({
      id: ORG_ID,
      profileId: ORG_PROFILE_ID,
      slug: ORG_SLUG,
    } as Awaited<ReturnType<typeof db.query.organizations.findFirst>>);
    vi.mocked(db.query.organizationUsers.findMany).mockResolvedValue(
      MEMBER_AUTH_USER_IDS.map((authUserId) => ({ authUserId })) as Awaited<
        ReturnType<typeof db.query.organizationUsers.findMany>
      >,
    );

    const returning = vi
      .fn()
      .mockResolvedValue([{ id: ORG_PROFILE_ID, slug: ORG_SLUG }]);
    vi.mocked(db.delete).mockReturnValue({
      where: vi.fn(() => ({ returning })),
    } as unknown as ReturnType<typeof db.delete>);
  });

  it('batch-invalidates every member of the org, not just the caller', async () => {
    await deleteOrganization({
      organizationProfileId: ORG_PROFILE_ID,
      user: caller,
    });

    expect(invalidateMultiple).toHaveBeenCalledWith({
      type: 'orgUser',
      paramsList: MEMBER_AUTH_USER_IDS.map((authUserId) =>
        orgUserCacheKey({ user: { id: authUserId }, organizationId: ORG_ID }),
      ),
    });

    // Per-member request memo invalidations
    for (const authUserId of MEMBER_AUTH_USER_IDS) {
      expect(getOrgAccessUser.invalidate).toHaveBeenCalledWith({
        user: { id: authUserId },
        organizationId: ORG_ID,
      });
    }

    // It must NOT invalidate using only the caller's key.
    expect(invalidate).not.toHaveBeenCalledWith({
      type: 'orgUser',
      params: orgUserCacheKey({ user: caller, organizationId: ORG_ID }),
    });
  });

  it('still invalidates the organization-by-id and organization-by-slug caches', async () => {
    await deleteOrganization({
      organizationProfileId: ORG_PROFILE_ID,
      user: caller,
    });

    expect(invalidate).toHaveBeenCalledWith({
      type: 'organization',
      params: [ORG_PROFILE_ID],
    });
    expect(invalidate).toHaveBeenCalledWith({
      type: 'organization',
      params: [ORG_SLUG],
    });
  });
});
