import { afterEach, describe, expect, it, vi } from 'vitest';

import { isFeatureEnabled } from './utils';

const { posthogIsFeatureEnabled } = vi.hoisted(() => ({
  posthogIsFeatureEnabled: vi.fn<() => Promise<boolean | undefined>>(),
}));

vi.mock('./client', () => ({
  default: () => ({
    capture() {},
    identify() {},
    isFeatureEnabled: posthogIsFeatureEnabled,
    async shutdown() {},
  }),
}));

describe('isFeatureEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    posthogIsFeatureEnabled.mockReset();
  });

  it('given a development build, when a flag is read, then it is on without asking PostHog', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    posthogIsFeatureEnabled.mockResolvedValue(false);

    await expect(isFeatureEnabled('sms-signup', 'server')).resolves.toBe(true);
    expect(posthogIsFeatureEnabled).not.toHaveBeenCalled();
  });

  it('given an end-to-end run, when a flag is read, then it is on without asking PostHog', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('NEXT_PUBLIC_E2E', 'true');
    posthogIsFeatureEnabled.mockResolvedValue(false);

    await expect(isFeatureEnabled('sms-signup', 'server')).resolves.toBe(true);
    expect(posthogIsFeatureEnabled).not.toHaveBeenCalled();
  });

  it('given a deployed build, when a flag is read, then PostHog decides', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_E2E', '');
    posthogIsFeatureEnabled.mockResolvedValue(true);

    await expect(isFeatureEnabled('sms-signup', 'server')).resolves.toBe(true);
    expect(posthogIsFeatureEnabled).toHaveBeenCalledWith(
      'sms-signup',
      'server',
    );
  });

  it('given a deployed build and PostHog has no answer, when a flag is read, then it is off', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_E2E', '');
    posthogIsFeatureEnabled.mockResolvedValue(undefined);

    await expect(isFeatureEnabled('sms-signup', 'server')).resolves.toBe(false);
  });
});
