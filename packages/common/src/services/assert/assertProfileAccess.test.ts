import { type NormalizedRole, permission } from 'access-zones';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getProfileAccessUser } from '../access';
import { assertProfileAccess } from './assertProfileAccess';

vi.mock('../access', () => ({
  getProfileAccessUser: vi.fn(),
}));

const mockGetProfileAccessUser = vi.mocked(getProfileAccessUser);

const user = { id: 'user-1' };
const profileId = 'profile-1';

const roleWithAccess = (access: Record<string, number>): NormalizedRole => ({
  id: 'role-1',
  name: 'role',
  access,
});

// The helper only reads `.roles`; cast the partial stub to the full resolved type.
const resolveWithRoles = (roles: NormalizedRole[]) =>
  mockGetProfileAccessUser.mockResolvedValue({ roles } as Awaited<
    ReturnType<typeof getProfileAccessUser>
  >);

describe('assertProfileAccess', () => {
  beforeEach(() => {
    mockGetProfileAccessUser.mockReset();
  });

  it('fetches the profile user for the given user + profileId', async () => {
    resolveWithRoles([roleWithAccess({ profile: permission.ADMIN })]);

    await assertProfileAccess(
      { user, profileId },
      { profile: permission.ADMIN },
    );

    expect(mockGetProfileAccessUser).toHaveBeenCalledWith({ user, profileId });
  });

  it('returns the resolved profileUser when the roles satisfy the permission', async () => {
    const roles = [roleWithAccess({ profile: permission.ADMIN })];
    resolveWithRoles(roles);

    await expect(
      assertProfileAccess({ user, profileId }, { profile: permission.ADMIN }),
    ).resolves.toEqual({ roles });
  });

  it('throws when the roles do not satisfy the required permission', async () => {
    resolveWithRoles([roleWithAccess({ profile: permission.READ })]);

    await expect(
      assertProfileAccess({ user, profileId }, { profile: permission.ADMIN }),
    ).rejects.toThrow();
  });

  it('throws when the user has no role on the profile (undefined profileUser)', async () => {
    mockGetProfileAccessUser.mockResolvedValue(undefined);

    await expect(
      assertProfileAccess({ user, profileId }, { profile: permission.ADMIN }),
    ).rejects.toThrow();
  });

  it('accepts an array of permissions (OR logic)', async () => {
    resolveWithRoles([roleWithAccess({ decisions: permission.READ })]);

    // Passes: one OR branch (decisions.READ) is satisfied.
    await expect(
      assertProfileAccess({ user, profileId }, [
        { decisions: permission.ADMIN },
        { decisions: permission.READ },
      ]),
    ).resolves.toBeDefined();

    // Throws: none of the OR branches match the granted roles.
    await expect(
      assertProfileAccess({ user, profileId }, [
        { decisions: permission.ADMIN },
        { profile: permission.ADMIN },
      ]),
    ).rejects.toThrow();
  });
});
