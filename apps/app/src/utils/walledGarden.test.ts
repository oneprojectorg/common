import type { CommonUser } from '@op/api/encoders';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { assertWalledGardenAccess } from './walledGarden';

const mocks = vi.hoisted(() => ({
  redirectToLogin: vi.fn(),
}));

vi.mock('./getUser', () => ({ redirectToLogin: mocks.redirectToLogin }));
vi.mock('next/navigation', () => ({
  forbidden: () => {
    throw new Error('FORBIDDEN');
  },
}));

const makeUser = (overrides: Partial<CommonUser> = {}): CommonUser => ({
  id: 'u1',
  authUserId: 'auth1',
  name: null,
  email: null,
  lastOrgId: null,
  profileId: null,
  currentProfileId: null,
  tos: null,
  privacy: null,
  createdAt: new Date().toISOString(),
  isAnonymous: false,
  isNetworkMember: true,
  ...overrides,
});

describe('assertWalledGardenAccess', () => {
  beforeEach(() => {
    mocks.redirectToLogin.mockReset();
    mocks.redirectToLogin.mockRejectedValue(new Error('LOGIN'));
  });

  it.each([
    ['a signed-out visitor', null],
    ['an anonymous session', makeUser({ isAnonymous: true })],
  ])('sends %s to login', async (_, user) => {
    await expect(assertWalledGardenAccess(user)).rejects.toThrow('LOGIN');
  });

  it('sends an anonymous session to login even when non-members are allowed', async () => {
    await expect(
      assertWalledGardenAccess(
        makeUser({ isAnonymous: true, isNetworkMember: false }),
        { allowNonMembers: true },
      ),
    ).rejects.toThrow('LOGIN');
  });

  it('forbids an account that is not a network member', async () => {
    await expect(
      assertWalledGardenAccess(makeUser({ isNetworkMember: false })),
    ).rejects.toThrow('FORBIDDEN');
    expect(mocks.redirectToLogin).not.toHaveBeenCalled();
  });

  it('admits a non-member when non-members are allowed', async () => {
    await expect(
      assertWalledGardenAccess(makeUser({ isNetworkMember: false }), {
        allowNonMembers: true,
      }),
    ).resolves.toBeUndefined();
  });

  it('admits a network member', async () => {
    await expect(assertWalledGardenAccess(makeUser())).resolves.toBeUndefined();
  });
});
