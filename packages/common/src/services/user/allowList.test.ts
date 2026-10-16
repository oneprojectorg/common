import { cache } from '@op/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { allowListCacheKey, getCachedAllowListUser } from './allowList';

// Regression: an allow-list entry holds one user's invitation (its
// organizationId and role), so the cache key must identify one user. Keying it
// by anything coarser — an email domain, say — makes the first caller's row the
// answer for every later caller in that domain, and the
// `allowListUser.organizationId === organization.id` check in joinOrganization
// then passes against someone else's invitation. Two same-domain users are
// enough to trigger it.

// `server-only` is blocked under Vitest; stub the db modules whose imports
// would resolve to it. The fetch path is never reached here because `cache` is
// mocked, so the handles only need to exist.
vi.mock('@op/db/client', () => ({
  db: { select: vi.fn() },
  eq: vi.fn(),
}));

vi.mock('@op/db/schema', () => ({
  allowList: { _: 'allowList' },
}));

vi.mock('@op/cache', () => ({
  cache: vi.fn(),
}));

const mockCache = vi.mocked(cache);

describe('allowListCacheKey', () => {
  it('gives two users in the same email domain distinct keys', () => {
    expect(allowListCacheKey({ email: 'alice@acme.com' })).not.toEqual(
      allowListCacheKey({ email: 'bob@acme.com' }),
    );
  });

  it('keys on the full email, not the domain', () => {
    expect(allowListCacheKey({ email: 'alice@acme.com' })).toEqual([
      'alice@acme.com',
    ]);
  });

  it('lowercases so casing variants share one entry', () => {
    expect(allowListCacheKey({ email: 'Alice@Acme.com' })).toEqual([
      'alice@acme.com',
    ]);
  });
});

describe('getCachedAllowListUser', () => {
  beforeEach(() => {
    mockCache.mockReset();
    mockCache.mockResolvedValue(undefined);
  });

  it('caches two same-domain users under distinct keys', async () => {
    await getCachedAllowListUser({ email: 'alice@acme.com' });
    await getCachedAllowListUser({ email: 'bob@acme.com' });

    const params = mockCache.mock.calls.map(([args]) => args.params);

    expect(params).toEqual([['alice@acme.com'], ['bob@acme.com']]);
  });

  it('reads the allowList cache type', async () => {
    await getCachedAllowListUser({ email: 'alice@acme.com' });

    expect(mockCache.mock.calls[0]?.[0].type).toBe('allowList');
  });
});
