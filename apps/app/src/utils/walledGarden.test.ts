import type { CommonUser } from '@op/api/encoders';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { assertWalledGardenAccess } from './walledGarden';

const mocks = vi.hoisted(() => ({
  headers: { 'x-pathname': '' },
}));

vi.mock('next/headers', () => ({
  headers: async () => new Headers(mocks.headers),
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
  forbidden: () => {
    throw new Error('FORBIDDEN');
  },
}));

const NEW_PATH = '/en/decisions/new';
const LOGIN_WITH_RETURN = `REDIRECT /login?redirect=${encodeURIComponent(NEW_PATH)}`;

const makeUser = (overrides: Partial<CommonUser>): CommonUser => ({
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
  isNetworkMember: false,
  ...overrides,
});

const anonymous = makeUser({ isAnonymous: true });
const member = makeUser({ isNetworkMember: true });
const outsider = makeUser({});

describe('assertWalledGardenAccess', () => {
  beforeEach(() => {
    mocks.headers = { 'x-pathname': NEW_PATH };
  });

  it.each([
    ['a signed-out visitor', null],
    ['an anonymous session', anonymous],
  ])('sends %s to login with the return path', async (_, user) => {
    await expect(assertWalledGardenAccess(user)).rejects.toThrow(
      LOGIN_WITH_RETURN,
    );
  });

  it.each([
    ['without a path', {}],
    ['for an unsafe path', { 'x-pathname': '//evil.example.com' }],
  ])('falls back to plain login %s', async (_, headers) => {
    mocks.headers = { 'x-pathname': '', ...headers };

    await expect(assertWalledGardenAccess(null)).rejects.toThrow(
      /^REDIRECT \/login$/,
    );
  });

  it('forbids a real account outside the network', async () => {
    await expect(assertWalledGardenAccess(outsider)).rejects.toThrow(
      'FORBIDDEN',
    );
  });

  it('admits an outsider when non-members are allowed', async () => {
    await expect(
      assertWalledGardenAccess(outsider, { allowNonMembers: true }),
    ).resolves.toBe(outsider);
  });

  it('still redirects an anonymous session when non-members are allowed', async () => {
    await expect(
      assertWalledGardenAccess(anonymous, { allowNonMembers: true }),
    ).rejects.toThrow(LOGIN_WITH_RETURN);
  });

  it('returns a network member', async () => {
    await expect(assertWalledGardenAccess(member)).resolves.toBe(member);
  });
});
