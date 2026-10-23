import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getRequiredUser, redirectToLogin } from './getUser';

const mocks = vi.hoisted(() => ({
  headers: { 'x-pathname': '' },
  getMyAccount: vi.fn(),
}));

vi.mock('@op/api/serverClient', () => ({
  createClient: async () => ({
    account: { getMyAccount: mocks.getMyAccount },
  }),
}));
vi.mock('next/headers', () => ({
  headers: async () => new Headers(mocks.headers),
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

const MANAGE_PATH = '/en/decisions/budget/manage';
const LOGIN_WITH_RETURN = `REDIRECT /login?redirect=${encodeURIComponent(MANAGE_PATH)}`;

describe('redirectToLogin', () => {
  it('carries the attempted path back through login', async () => {
    mocks.headers = { 'x-pathname': MANAGE_PATH };

    await expect(redirectToLogin()).rejects.toThrow(LOGIN_WITH_RETURN);
  });

  it.each([
    ['without a path', {}],
    ['for an unsafe path', { 'x-pathname': '//evil.example.com' }],
  ])('falls back to plain login %s', async (_, headers) => {
    mocks.headers = { 'x-pathname': '', ...headers };

    await expect(redirectToLogin()).rejects.toThrow(/^REDIRECT \/login$/);
  });
});

describe('getRequiredUser', () => {
  beforeEach(() => {
    mocks.headers = { 'x-pathname': MANAGE_PATH };
  });

  it.each([
    ['a signed-out visitor', null],
    ['an anonymous session', { isAnonymous: true }],
  ])('sends %s to login with the return path', async (_, account) => {
    mocks.getMyAccount.mockResolvedValue(account);

    await expect(getRequiredUser()).rejects.toThrow(LOGIN_WITH_RETURN);
  });

  it('resolves a signed-in user', async () => {
    const user = { isAnonymous: false, authUserId: 'auth-user-1' };
    mocks.getMyAccount.mockResolvedValue(user);

    await expect(getRequiredUser()).resolves.toBe(user);
  });
});
