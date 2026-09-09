import { GLOBAL_USER_PUBLIC } from '@op/core';
import { permission } from 'access-zones';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// `@op/db/client` pulls in `server-only`, which Vitest can't load, so the
// relational query builder is faked. The own-profile anchor lives in SQL and is
// covered by the integration test in `services/api`; what is asserted here is
// the JS-side filter applied to the rows that anchor returns.
const findMany = vi.fn();

vi.mock('@op/db/client', () => ({
  db: {
    query: { profileUsers: { findMany: () => findMany() } },
    select: () => ({ from: () => ({ where: () => ({}) }) }),
  },
  eq: vi.fn(),
}));

vi.mock('@op/db/schema', () => ({
  users: { authUserId: 'users.authUserId', profileId: 'users.profileId' },
}));

import { getUserGlobalRoles, isPlatformAdmin } from './platformAdmin';

const AUTH_USER_ID = '00000000-0000-4000-a000-0000000000b2';
const PLATFORM_ADMIN_ROLE_ID = '00000000-0000-4000-8000-000000000014';
const ADMIN_ROLE_ID = '00000000-0000-4000-8000-000000000011';
const PROFILE_ID = '00000000-0000-4000-a000-0000000000c3';

const zoneRow = (zoneId: string, name: string, bits: number) => ({
  accessZoneId: zoneId,
  permission: bits,
  profileId: null,
  accessZone: { id: zoneId, name },
});

const platformAdminRole = {
  id: PLATFORM_ADMIN_ROLE_ID,
  name: 'Platform Admin',
  profileId: null,
  zonePermissions: [
    zoneRow(
      '00000000-0000-4000-8000-000000000004',
      'platform',
      permission.ADMIN,
    ),
  ],
};

const triggerAdminRole = {
  id: ADMIN_ROLE_ID,
  name: 'Admin',
  profileId: null,
  zonePermissions: [
    zoneRow('00000000-0000-4000-8000-000000000002', 'admin', permission.ADMIN),
  ],
};

const ownProfileMembership = (
  roles: Array<{ id: string; name: string; profileId: string | null }>,
) => ({
  id: 'profile-user-1',
  authUserId: AUTH_USER_ID,
  profileId: PROFILE_ID,
  roles: roles.map((accessRole) => ({ accessRole })),
});

beforeEach(() => {
  findMany.mockReset();
  findMany.mockResolvedValue([]);
});

describe('getUserGlobalRoles', () => {
  it('keeps an allowlisted global role held on the own profile', async () => {
    findMany.mockResolvedValue([ownProfileMembership([platformAdminRole])]);

    await expect(
      getUserGlobalRoles({ user: { id: AUTH_USER_ID } }),
    ).resolves.toEqual([
      {
        id: PLATFORM_ADMIN_ROLE_ID,
        name: 'Platform Admin',
        access: { platform: permission.ADMIN },
      },
    ]);
  });

  it('drops the trigger-granted global Admin role', async () => {
    findMany.mockResolvedValue([
      ownProfileMembership([triggerAdminRole, platformAdminRole]),
    ]);

    await expect(
      getUserGlobalRoles({ user: { id: AUTH_USER_ID } }),
    ).resolves.toEqual([expect.objectContaining({ name: 'Platform Admin' })]);
  });

  it('drops a profile-scoped role that shares the allowlisted name', async () => {
    findMany.mockResolvedValue([
      ownProfileMembership([{ ...platformAdminRole, profileId: PROFILE_ID }]),
    ]);

    await expect(
      getUserGlobalRoles({ user: { id: AUTH_USER_ID } }),
    ).resolves.toEqual([]);
  });

  it('is empty when the own profile carries no membership row', async () => {
    await expect(
      getUserGlobalRoles({ user: { id: AUTH_USER_ID } }),
    ).resolves.toEqual([]);
  });

  it('fails closed for an undefined user without querying', async () => {
    await expect(getUserGlobalRoles({})).resolves.toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('fails closed for the public sentinel without querying', async () => {
    await expect(
      getUserGlobalRoles({ user: { id: GLOBAL_USER_PUBLIC } }),
    ).resolves.toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe('isPlatformAdmin', () => {
  it('is true when the platform zone carries the ADMIN bit', async () => {
    findMany.mockResolvedValue([ownProfileMembership([platformAdminRole])]);

    await expect(isPlatformAdmin({ user: { id: AUTH_USER_ID } })).resolves.toBe(
      true,
    );
  });

  it('is false for the trigger-granted Admin role alone', async () => {
    findMany.mockResolvedValue([ownProfileMembership([triggerAdminRole])]);

    await expect(isPlatformAdmin({ user: { id: AUTH_USER_ID } })).resolves.toBe(
      false,
    );
  });

  it('is false when the own profile carries no membership row', async () => {
    await expect(isPlatformAdmin({ user: { id: AUTH_USER_ID } })).resolves.toBe(
      false,
    );
  });
});
