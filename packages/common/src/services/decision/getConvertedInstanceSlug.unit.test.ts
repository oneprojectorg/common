import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UnauthorizedError } from '../../utils';
import { getConvertedInstanceSlug } from './getConvertedInstanceSlug';

const { getCachedInstance, assertProfileAccess } = vi.hoisted(() => ({
  getCachedInstance: vi.fn(),
  assertProfileAccess: vi.fn(),
}));

// `@op/db/client` pulls in `server-only`, which Vitest can't load.
vi.mock('@op/db/client', () => ({ db: {}, eq: vi.fn() }));
vi.mock('@op/db/schema', () => ({ processInstances: {} }));
vi.mock('./getCachedInstance', () => ({ getCachedInstance }));
vi.mock('../assert', () => ({ assertProfileAccess }));

const instanceId = '7962ff89-babb-4a99-a4ed-e35d8795b416';
const converted = {
  instanceData: {},
  profileId: 'profile-1',
  profile: { slug: 'riverbend-2026' },
};

describe('getConvertedInstanceSlug', () => {
  beforeEach(() => {
    getCachedInstance.mockReset().mockResolvedValue(converted);
    assertProfileAccess.mockReset().mockResolvedValue([]);
  });

  it('returns the slug when the profile access check passes', async () => {
    await expect(
      getConvertedInstanceSlug({ instanceId, user: undefined }),
    ).resolves.toBe('riverbend-2026');

    expect(assertProfileAccess).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: 'profile-1' }),
    );
  });

  it('returns null when the caller is not authorized', async () => {
    assertProfileAccess.mockRejectedValue(new UnauthorizedError('no'));

    await expect(
      getConvertedInstanceSlug({ instanceId, user: undefined }),
    ).resolves.toBeNull();
  });

  it('rethrows an error that is not an authorization denial', async () => {
    const error = new Error('db down');
    assertProfileAccess.mockRejectedValue(error);

    await expect(
      getConvertedInstanceSlug({ instanceId, user: undefined }),
    ).rejects.toBe(error);
  });

  it.each([
    ['a missing instance', null],
    [
      'a legacy instance',
      { ...converted, instanceData: { currentStateId: 's' } },
    ],
    ['an instance without a profile slug', { ...converted, profile: null }],
  ])('returns null for %s without an access check', async (_case, instance) => {
    getCachedInstance.mockResolvedValue(instance);

    await expect(
      getConvertedInstanceSlug({ instanceId, user: undefined }),
    ).resolves.toBeNull();

    expect(assertProfileAccess).not.toHaveBeenCalled();
  });
});
