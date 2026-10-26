import { PostHogClient } from '@op/analytics';
import { areFeatureFlagsForcedOn } from '@op/analytics/client-utils';
import { cache } from '@op/cache';
import { logger } from '@op/logging';

const TTL = 60 * 1000;

// A string, not a boolean: `cache()` never stores a falsy value.
type FlagState = 'on' | 'off' | 'unreadable';

/**
 * Agrees with `useFeatureFlag` only for person or cohort targeting: the browser
 * identifies a user only after tracking consent.
 *
 * Unlike `@op/analytics`'s `isFeatureEnabled`, this caches for {@link TTL} and
 * fails closed: a PostHog outage reads as off once the cached answer expires.
 */
export const isServerFeatureEnabled = async ({
  key,
  distinctId,
}: {
  key: string;
  distinctId: string;
}): Promise<boolean> => {
  if (areFeatureFlagsForcedOn()) {
    return true;
  }

  const state = await cache({
    type: 'featureFlag',
    params: [key, distinctId],
    fetch: () => readFlag({ key, distinctId }),
    options: {
      ttl: TTL,
      // The L1 copy of a Redis hit restarts the clock; Redis alone keeps the bound.
      skipMemCache: true,
      skipCacheWrite: (result) => result === 'unreadable',
    },
  });

  return state === 'on';
};

const readFlag = async ({
  key,
  distinctId,
}: {
  key: string;
  distinctId: string;
}): Promise<FlagState> => {
  try {
    const answer = await PostHogClient().isFeatureEnabled(key, distinctId);

    // posthog-node resolves `undefined` for a timeout or an unknown key.
    if (answer === undefined) {
      logger.warn('PostHog returned no answer for a feature flag', { key });
      return 'unreadable';
    }

    return answer ? 'on' : 'off';
  } catch (error) {
    logger.error('Feature flag lookup failed', { key, error });
    return 'unreadable';
  }
};
