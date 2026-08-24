import type { CommonUser } from '@op/api/encoders';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestHeaders = new Map<string, string>();

vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (name: string) => requestHeaders.get(name) ?? null,
  }),
}));

// `redirect`/`forbidden` signal control flow by throwing; mirror that so a test
// can assert the gate stopped rendering rather than fell through.
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
  forbidden: () => {
    throw new Error('NEXT_FORBIDDEN');
  },
}));

const { assertWalledGardenAccess, requireRealAccount } =
  await import('./walledGarden');

const asUser = (overrides: Partial<CommonUser>) =>
  ({
    id: 'user-1',
    isAnonymous: false,
    isNetworkMember: true,
    ...overrides,
  }) as CommonUser;

beforeEach(() => {
  requestHeaders.clear();
  requestHeaders.set('x-pathname', '/en/decisions/participatory-budget');
});

describe('requireRealAccount', () => {
  it('returns a real account untouched', async () => {
    const user = asUser({ isNetworkMember: false });

    await expect(requireRealAccount(user)).resolves.toBe(user);
  });

  it.each([
    ['no session', null],
    ['an undefined user', undefined],
  ])('sends %s to login with the attempted path', async (_label, user) => {
    await expect(requireRealAccount(user)).rejects.toThrow(
      'NEXT_REDIRECT:/login?redirect=%2Fen%2Fdecisions%2Fparticipatory-budget',
    );
  });

  // An anonymous user owns anon-submitted content, so they need the link flow
  // that keeps it on the same auth user — not a fresh account.
  it('sends an anonymous session to the account-link flow', async () => {
    await expect(
      requireRealAccount(asUser({ isAnonymous: true })),
    ).rejects.toThrow(
      'NEXT_REDIRECT:/login?link=1&redirect=%2Fen%2Fdecisions%2Fparticipatory-budget',
    );
  });

  it('carries the query string so a deep link survives the bounce', async () => {
    requestHeaders.set('x-search', '?panel=updates&proposal=abc');

    await expect(requireRealAccount(null)).rejects.toThrow(
      'NEXT_REDIRECT:/login?redirect=%2Fen%2Fdecisions%2Fparticipatory-budget%3Fpanel%3Dupdates%26proposal%3Dabc',
    );
  });

  it('drops an unsafe redirect path rather than forwarding it', async () => {
    requestHeaders.set('x-pathname', 'https://evil.example.com/phish');

    await expect(requireRealAccount(null)).rejects.toThrow(
      'NEXT_REDIRECT:/login',
    );
  });

  it('still offers the link flow when the path is unsafe', async () => {
    requestHeaders.set('x-pathname', 'https://evil.example.com/phish');

    await expect(
      requireRealAccount(asUser({ isAnonymous: true })),
    ).rejects.toThrow('NEXT_REDIRECT:/login?link=1');
  });
});

describe('assertWalledGardenAccess', () => {
  it('admits a network member', async () => {
    await expect(
      assertWalledGardenAccess(asUser({ isNetworkMember: true })),
    ).resolves.toBeUndefined();
  });

  it('shows a non-member real account the forbidden screen, not login', async () => {
    await expect(
      assertWalledGardenAccess(asUser({ isNetworkMember: false })),
    ).rejects.toThrow('NEXT_FORBIDDEN');
  });

  it('admits a non-member when allowNonMembers is set', async () => {
    await expect(
      assertWalledGardenAccess(asUser({ isNetworkMember: false }), {
        allowNonMembers: true,
      }),
    ).resolves.toBeUndefined();
  });

  it('still redirects an anonymous session when allowNonMembers is set', async () => {
    await expect(
      assertWalledGardenAccess(asUser({ isAnonymous: true }), {
        allowNonMembers: true,
      }),
    ).rejects.toThrow(/NEXT_REDIRECT:\/login\?link=1&redirect=/);
  });
});
