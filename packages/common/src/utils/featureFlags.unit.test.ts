import { beforeEach, describe, expect, it, vi } from 'vitest';

import { isServerFeatureEnabled } from './featureFlags';

const { getAllFlags, areFeatureFlagsForcedOn, cache, error } = vi.hoisted(
  () => ({
    getAllFlags:
      vi.fn<(id: string) => Promise<Record<string, string | boolean>>>(),
    areFeatureFlagsForcedOn: vi.fn<() => boolean>(),
    cache: vi.fn<(typeof import('@op/cache'))['cache']>(),
    error: vi.fn(),
  }),
);

vi.mock('@op/analytics', () => ({
  PostHogClient: () => ({ getAllFlags }),
}));

vi.mock('@op/analytics/client-utils', () => ({ areFeatureFlagsForcedOn }));

vi.mock('@op/cache', () => ({ cache }));

vi.mock('@op/logging', () => ({ logger: { error } }));

const params = { key: 'new_process_admin_enabled', distinctId: 'auth-1' };

describe('isServerFeatureEnabled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    areFeatureFlagsForcedOn.mockReturnValue(false);
    cache.mockImplementation(async ({ fetch }) => fetch());
  });

  it('is on without asking PostHog when flags are forced on', async () => {
    areFeatureFlagsForcedOn.mockReturnValue(true);

    await expect(isServerFeatureEnabled(params)).resolves.toBe(true);
    expect(getAllFlags).not.toHaveBeenCalled();
    expect(cache).not.toHaveBeenCalled();
  });

  it('is off without asking PostHog for an empty identity', async () => {
    await expect(
      isServerFeatureEnabled({ ...params, distinctId: '' }),
    ).resolves.toBe(false);
    expect(getAllFlags).not.toHaveBeenCalled();
    expect(cache).not.toHaveBeenCalled();
  });

  it('caches every flag for a user under one key, outside the L1', async () => {
    getAllFlags.mockResolvedValue({ [params.key]: true, other: false });

    await expect(isServerFeatureEnabled(params)).resolves.toBe(true);
    expect(getAllFlags).toHaveBeenCalledWith(params.distinctId);
    expect(cache).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'featureFlags',
        params: [params.distinctId],
        options: expect.objectContaining({ skipMemCache: true }),
      }),
    );
  });

  it('is off for a disabled flag', async () => {
    getAllFlags.mockResolvedValue({ [params.key]: false });

    await expect(isServerFeatureEnabled(params)).resolves.toBe(false);
  });

  it('is off for a flag PostHog does not know', async () => {
    getAllFlags.mockResolvedValue({ other: true });

    await expect(isServerFeatureEnabled(params)).resolves.toBe(false);
  });

  it('is on for a variant of a multivariate flag', async () => {
    getAllFlags.mockResolvedValue({ [params.key]: 'control' });

    await expect(isServerFeatureEnabled(params)).resolves.toBe(true);
  });

  it('is off when PostHog answers with nothing', async () => {
    getAllFlags.mockResolvedValue({});

    await expect(isServerFeatureEnabled(params)).resolves.toBe(false);
  });

  it('is off and logs when the lookup throws', async () => {
    const failure = new Error('no api key');
    getAllFlags.mockRejectedValue(failure);

    await expect(isServerFeatureEnabled(params)).resolves.toBe(false);
    expect(error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ error: failure }),
    );
  });
});
