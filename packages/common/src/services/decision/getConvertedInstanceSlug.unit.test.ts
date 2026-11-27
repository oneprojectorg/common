import { permission } from 'access-zones';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getConvertedInstanceSlug } from './getConvertedInstanceSlug';

const { getCachedInstance, getProfileAccessRoles } = vi.hoisted(() => ({
  getCachedInstance: vi.fn(),
  getProfileAccessRoles: vi.fn(),
}));

// `@op/db/client` pulls in `server-only`, which Vitest can't load.
vi.mock('@op/db/client', () => ({ db: {}, eq: vi.fn() }));
vi.mock('@op/db/schema', () => ({ processInstances: {} }));
vi.mock('./getCachedInstance', () => ({ getCachedInstance }));
vi.mock('../access', () => ({ getProfileAccessRoles }));

const instanceId = '7962ff89-babb-4a99-a4ed-e35d8795b416';
const converted = {
  instanceData: {},
  profileId: 'profile-1',
  profile: { slug: 'riverbend-2026' },
};

const role = (decisions: number) => ({
  id: 'role-1',
  name: 'Role',
  access: { decisions },
});

describe('getConvertedInstanceSlug', () => {
  beforeEach(() => {
    getCachedInstance.mockReset().mockResolvedValue(converted);
    getProfileAccessRoles.mockReset().mockResolvedValue([]);
  });

  it.each([
    ['READ', permission.READ],
    ['ADMIN', permission.ADMIN],
  ])('returns the slug to a caller with decisions %s', async (_name, bits) => {
    getProfileAccessRoles.mockResolvedValue([role(bits)]);

    await expect(
      getConvertedInstanceSlug({ instanceId, user: undefined }),
    ).resolves.toBe('riverbend-2026');

    expect(getProfileAccessRoles).toHaveBeenCalledWith({
      user: undefined,
      profileId: 'profile-1',
    });
  });

  it('returns null to a caller with no role on the profile', async () => {
    await expect(
      getConvertedInstanceSlug({ instanceId, user: undefined }),
    ).resolves.toBeNull();
  });

  it('returns null to a caller whose role lacks decisions READ', async () => {
    getProfileAccessRoles.mockResolvedValue([role(0)]);

    await expect(
      getConvertedInstanceSlug({ instanceId, user: undefined }),
    ).resolves.toBeNull();
  });

  it('rethrows a failed role lookup', async () => {
    const error = new Error('db down');
    getProfileAccessRoles.mockRejectedValue(error);

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

    expect(getProfileAccessRoles).not.toHaveBeenCalled();
  });
});
