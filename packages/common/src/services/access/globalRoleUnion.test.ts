import { permission } from 'access-zones';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// `@op/db/client` pulls in `server-only`, which Vitest can't load, so the query
// builder, the durable cache and the user-level resolver are faked.
const findProfileUsers = vi.fn();
const getUserGlobalRoles = vi.fn();

vi.mock('@op/db/client', () => ({
  db: {
    query: {
      profileUsers: { findMany: () => findProfileUsers() },
      accessRoles: { findFirst: vi.fn() },
    },
  },
  and: vi.fn(),
  eq: vi.fn(),
}));

vi.mock('@op/cache', () => ({
  cache: <T>({ fetch }: { fetch: () => T }) => fetch(),
  invalidate: vi.fn(),
  invalidateMultiple: vi.fn(),
}));

vi.mock('./platformAdmin', () => ({
  PLATFORM_ZONE_NAME: 'platform',
  PLATFORM_ADMIN_ROLE_NAME: 'Platform Admin',
  USER_LEVEL_GLOBAL_ROLE_NAMES: ['Platform Admin'],
  getUserGlobalRoles: (args: unknown) => getUserGlobalRoles(args),
  isPlatformAdmin: vi.fn(),
}));

import { UnauthorizedError } from '../../utils/error';
import { assertProfileAccess } from '../assert/assertProfileAccess';
import { getProfileAccessRoles } from './index';

const AUTH_USER_ID = '00000000-0000-4000-a000-0000000000b2';
const PROFILE_ID = '00000000-0000-4000-a000-0000000000c3';
const PLATFORM_ADMIN_ROLE_ID = '00000000-0000-4000-8000-000000000014';

const zoneRow = (zoneId: string, name: string, bits: number) => ({
  accessRoleId: 'role',
  accessZoneId: zoneId,
  permission: bits,
  profileId: null,
  accessZone: { id: zoneId, name },
});

const platformAdminZonePermissions = [
  zoneRow('00000000-0000-4000-8000-000000000004', 'platform', permission.ADMIN),
  zoneRow(
    '00000000-0000-4000-8000-000000000001',
    'profile',
    permission.ADMIN | permission.READ,
  ),
];

const platformAdminGlobalRole = {
  id: PLATFORM_ADMIN_ROLE_ID,
  name: 'Platform Admin',
  access: {
    platform: permission.ADMIN,
    profile: permission.ADMIN | permission.READ,
  },
};

const memberRole = {
  accessRole: {
    id: '00000000-0000-4000-8000-000000000012',
    name: 'Member',
    profileId: null,
    zonePermissions: [
      zoneRow(
        '00000000-0000-4000-8000-000000000001',
        'profile',
        permission.READ,
      ),
    ],
  },
};

const membershipWith = (roles: Array<typeof memberRole>) => ({
  id: 'profile-user-1',
  authUserId: AUTH_USER_ID,
  profileId: PROFILE_ID,
  profile: { id: PROFILE_ID, name: 'Test profile' },
  roles,
});

beforeEach(() => {
  findProfileUsers.mockReset();
  getUserGlobalRoles.mockReset();
  getUserGlobalRoles.mockResolvedValue([]);
});

describe('profile access with a user-level Platform Admin role', () => {
  it('ORs the global role into a membership the caller already has', async () => {
    findProfileUsers.mockResolvedValue([membershipWith([memberRole])]);
    getUserGlobalRoles.mockResolvedValue([platformAdminGlobalRole]);

    await expect(
      assertProfileAccess({
        user: { id: AUTH_USER_ID },
        profileId: PROFILE_ID,
        permissions: { profile: permission.ADMIN },
      }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Platform Admin' }),
        expect.objectContaining({ name: 'Member' }),
      ]),
    );
  });

  it('does not manufacture a membership the caller lacks (ADR 0005)', async () => {
    findProfileUsers.mockResolvedValue([]);
    getUserGlobalRoles.mockResolvedValue([platformAdminGlobalRole]);

    await expect(
      getProfileAccessRoles({
        user: { id: AUTH_USER_ID },
        profileId: PROFILE_ID,
      }),
    ).resolves.toEqual([]);

    await expect(
      assertProfileAccess({
        user: { id: AUTH_USER_ID },
        profileId: PROFILE_ID,
        permissions: { profile: permission.ADMIN },
      }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('leaves a caller without the global role on their own roles', async () => {
    findProfileUsers.mockResolvedValue([membershipWith([memberRole])]);

    await expect(
      assertProfileAccess({
        user: { id: AUTH_USER_ID },
        profileId: PROFILE_ID,
        permissions: { profile: permission.ADMIN },
      }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('adds the role once when the membership row already carries it', async () => {
    findProfileUsers.mockResolvedValue([
      membershipWith([
        memberRole,
        {
          accessRole: {
            id: PLATFORM_ADMIN_ROLE_ID,
            name: 'Platform Admin',
            profileId: null,
            zonePermissions: platformAdminZonePermissions,
          },
        },
      ]),
    ]);
    getUserGlobalRoles.mockResolvedValue([platformAdminGlobalRole]);

    const roles = await getProfileAccessRoles({
      user: { id: AUTH_USER_ID },
      profileId: PROFILE_ID,
    });

    expect(
      roles.filter((role) => role.id === PLATFORM_ADMIN_ROLE_ID),
    ).toHaveLength(1);
  });
});
