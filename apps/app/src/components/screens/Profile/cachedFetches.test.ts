import { EntityType } from '@op/api/encoders';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchProfileScreenData } from './cachedFetches';

const { getProfileBySlug, getOrganizationBySlug } = vi.hoisted(() => ({
  getProfileBySlug: vi.fn(),
  getOrganizationBySlug: vi.fn(),
}));

vi.mock('@op/api/serverClient', () => ({
  createClient: async () => ({
    profile: { getBySlug: getProfileBySlug },
    organization: { getBySlug: getOrganizationBySlug },
  }),
}));

const nonOrgTypes = Object.values(EntityType).filter(
  (type) => type !== EntityType.ORG,
);

const organizationProfile = {
  id: 'profile-org',
  type: EntityType.ORG,
  name: 'Just Transitions',
  slug: 'justtransitions',
};

const organization = { id: 'org-1' };

describe('fetchProfileScreenData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Pinned so adding an entity type fails here and has to be classified as
  // org-backed or not, rather than being absorbed silently by the filter above.
  it('covers every non-org entity type', () => {
    expect(nonOrgTypes).toHaveLength(4);
  });

  // The org lookup throws for every slug that isn't an org, and tRPC logs that
  // throw as a server error before the caller ever sees it.
  it.each(nonOrgTypes)(
    'skips the organization lookup for a %s profile',
    async (type) => {
      const slug = `kathy-${type}`;
      const profile = { id: 'profile-1', type, name: 'Kathy', slug };
      getProfileBySlug.mockResolvedValue(profile);

      const result = await fetchProfileScreenData(slug);

      expect(result).toEqual({ kind: 'nonOrganization', profile });
      expect(getProfileBySlug).toHaveBeenCalledWith({ slug });
      expect(getOrganizationBySlug).not.toHaveBeenCalled();
    },
  );

  it('loads the organization for an org profile', async () => {
    getProfileBySlug.mockResolvedValue(organizationProfile);
    getOrganizationBySlug.mockResolvedValue(organization);

    const result = await fetchProfileScreenData('justtransitions');

    expect(result).toEqual({
      kind: 'organization',
      profile: organizationProfile,
      organization,
    });
    expect(getProfileBySlug).toHaveBeenCalledWith({ slug: 'justtransitions' });
    expect(getOrganizationBySlug).toHaveBeenCalledWith({
      slug: 'justtransitions',
    });
  });

  it('propagates a failed organization lookup instead of returning null', async () => {
    getProfileBySlug.mockResolvedValue({
      ...organizationProfile,
      slug: 'ialamesoamerica',
    });
    getOrganizationBySlug.mockRejectedValue(
      new Error("Organization with ID 'ialamesoamerica' not found."),
    );

    await expect(fetchProfileScreenData('ialamesoamerica')).rejects.toThrow(
      'not found',
    );
  });
});
