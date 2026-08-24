import type { CommonUser } from '@op/api/encoders';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const headersGet = vi.fn<(name: string) => string | null>();

vi.mock('next/headers', () => ({
  headers: async () => ({ get: headersGet }),
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
  headersGet.mockReset();
  headersGet.mockReturnValue('/en/decisions/participatory-budget');
});

describe('requireRealAccount', () => {
  it('returns a real account untouched', async () => {
    const user = asUser({ isNetworkMember: false });

    await expect(requireRealAccount(user)).resolves.toBe(user);
  });

  it.each([
    ['no session', null],
    ['an undefined user', undefined],
    ['an anonymous session', asUser({ isAnonymous: true })],
  ])('sends %s to login with the attempted path', async (_label, user) => {
    await expect(requireRealAccount(user)).rejects.toThrow(
      'NEXT_REDIRECT:/login?redirect=%2Fen%2Fdecisions%2Fparticipatory-budget',
    );
  });

  it('drops an unsafe redirect path rather than forwarding it', async () => {
    headersGet.mockReturnValue('https://evil.example.com/phish');

    await expect(requireRealAccount(null)).rejects.toThrow(
      'NEXT_REDIRECT:/login',
    );
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
    ).rejects.toThrow(/NEXT_REDIRECT:\/login\?redirect=/);
  });
});
