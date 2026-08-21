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

// Derived rather than listed so a new entity type has to be classified here too.
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

  // The org lookup throws for every slug that isn't an org, and tRPC logs that
  // throw as a server error before the caller ever sees it.
  it.each(nonOrgTypes)(
    'skips the organization lookup for a %s profile',
    async (type) => {
      const profile = { id: 'profile-1', type, name: 'Kathy', slug: 'kathy' };
      getProfileBySlug.mockResolvedValue(profile);

      const result = await fetchProfileScreenData('kathy');

      expect(result).toEqual({ kind: 'individual', profile });
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
