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

  // An anonymous user owns anon-submitted content, so a caller that opts in
  // gets the link flow, which keeps that content on the same auth user.
  it('sends an anonymous session to the link flow only when asked', async () => {
    await expect(
      requireRealAccount(asUser({ isAnonymous: true }), {
        linkAnonymous: true,
      }),
    ).rejects.toThrow(
      'NEXT_REDIRECT:/login?link=1&redirect=%2Fen%2Fdecisions%2Fparticipatory-budget',
    );
  });

  // Link mode claims an account through useClaimAccount, which bypasses the
  // invite-only allow-list — so it must stay off unless a caller opts in.
  it('leaves an anonymous session on the plain panel by default', async () => {
    await expect(
      requireRealAccount(asUser({ isAnonymous: true })),
    ).rejects.toThrow(
      /^NEXT_REDIRECT:\/login\?redirect=%2Fen%2Fdecisions%2Fparticipatory-budget$/,
    );
  });

  it('carries the query string so a deep link survives the bounce', async () => {
    requestHeaders.set('x-search', '?panel=updates&proposal=abc');

    await expect(requireRealAccount(null)).rejects.toThrow(
      'NEXT_REDIRECT:/login?redirect=%2Fen%2Fdecisions%2Fparticipatory-budget%3Fpanel%3Dupdates%26proposal%3Dabc',
    );
  });

  // Anchored: a substring match would still pass if the unsafe path leaked
  // through as a `redirect=` param, which is the whole point of the guard.
  it('drops an unsafe redirect path rather than forwarding it', async () => {
    requestHeaders.set('x-pathname', 'https://evil.example.com/phish');

    await expect(requireRealAccount(null)).rejects.toThrow(
      /^NEXT_REDIRECT:\/login$/,
    );
  });

  it('still offers the link flow when the path is unsafe', async () => {
    requestHeaders.set('x-pathname', 'https://evil.example.com/phish');

    await expect(
      requireRealAccount(asUser({ isAnonymous: true }), {
        linkAnonymous: true,
      }),
    ).rejects.toThrow(/^NEXT_REDIRECT:\/login\?link=1$/);
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

  it('preserves the query string on the way to login', async () => {
    requestHeaders.set('x-pathname', '/en/start');
    requestHeaders.set('x-search', '?promote=1');

    await expect(assertWalledGardenAccess(null)).rejects.toThrow(
      /^NEXT_REDIRECT:\/login\?redirect=%2Fen%2Fstart%3Fpromote%3D1$/,
    );
  });

  it('still redirects an anonymous session when allowNonMembers is set', async () => {
    await expect(
      assertWalledGardenAccess(asUser({ isAnonymous: true }), {
        allowNonMembers: true,
      }),
      // The closed-network gate never opts into link mode: claiming an account
      // there would route around the invite-only allow-list.
    ).rejects.toThrow(/^NEXT_REDIRECT:\/login\?redirect=/);
  });
});
