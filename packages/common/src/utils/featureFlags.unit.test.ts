import { beforeEach, describe, expect, it, vi } from 'vitest';

import { isServerFeatureEnabled } from './featureFlags';

const { isFeatureEnabled, areFeatureFlagsForcedOn, cache, warn, error } =
  vi.hoisted(() => ({
    isFeatureEnabled: vi.fn<(key: string, id: string) => Promise<unknown>>(),
    areFeatureFlagsForcedOn: vi.fn<() => boolean>(),
    cache: vi.fn<(typeof import('@op/cache'))['cache']>(),
    warn: vi.fn(),
    error: vi.fn(),
  }));

vi.mock('@op/analytics', () => ({
  PostHogClient: () => ({ isFeatureEnabled }),
}));

vi.mock('@op/analytics/client-utils', () => ({ areFeatureFlagsForcedOn }));

vi.mock('@op/cache', () => ({ cache }));

vi.mock('@op/logging', () => ({ logger: { warn, error } }));

let written: unknown;

const params = { key: 'new_process_admin_enabled', distinctId: 'auth-1' };

describe('isServerFeatureEnabled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    written = undefined;
    areFeatureFlagsForcedOn.mockReturnValue(false);
    cache.mockImplementation(async ({ fetch, options }) => {
      const result = await fetch();
      written = options?.skipCacheWrite?.(result) ? undefined : result;

      return result;
    });
  });

  it('is on without asking PostHog when flags are forced on', async () => {
    areFeatureFlagsForcedOn.mockReturnValue(true);

    await expect(isServerFeatureEnabled(params)).resolves.toBe(true);
    expect(isFeatureEnabled).not.toHaveBeenCalled();
    expect(cache).not.toHaveBeenCalled();
  });

  it('caches an enabled flag per key and user', async () => {
    isFeatureEnabled.mockResolvedValue(true);

    await expect(isServerFeatureEnabled(params)).resolves.toBe(true);
    expect(isFeatureEnabled).toHaveBeenCalledWith(
      params.key,
      params.distinctId,
    );
    expect(cache).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'featureFlag',
        params: [params.key, params.distinctId],
        options: expect.objectContaining({ skipMemCache: true }),
      }),
    );
    expect(written).toBe('on');
  });

  it('caches a disabled flag', async () => {
    isFeatureEnabled.mockResolvedValue(false);

    await expect(isServerFeatureEnabled(params)).resolves.toBe(false);
    expect(written).toBe('off');
  });

  it('is off, warns and does not cache when PostHog has no answer', async () => {
    isFeatureEnabled.mockResolvedValue(undefined);

    await expect(isServerFeatureEnabled(params)).resolves.toBe(false);
    expect(warn).toHaveBeenCalledOnce();
    expect(written).toBeUndefined();
  });

  it('is off, logs and does not cache when the lookup throws', async () => {
    const failure = new Error('posthog down');
    isFeatureEnabled.mockRejectedValue(failure);

    await expect(isServerFeatureEnabled(params)).resolves.toBe(false);
    expect(error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ error: failure }),
    );
    expect(written).toBeUndefined();
  });
});
