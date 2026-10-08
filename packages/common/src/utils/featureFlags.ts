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
 */
export const isServerFeatureEnabled = async (
  key: string,
  distinctId: string,
): Promise<boolean> => {
  if (areFeatureFlagsForcedOn()) {
    return true;
  }

  const state = await cache({
    type: 'featureFlag',
    params: [key, distinctId],
    fetch: () => readFlag(key, distinctId),
    options: {
      ttl: TTL,
      // Keep the last good answer through an outage.
      skipCacheWrite: (result) => result === 'unreadable',
    },
  });

  return state === 'on';
};

const readFlag = async (
  key: string,
  distinctId: string,
): Promise<FlagState> => {
  try {
    const answer = await PostHogClient().isFeatureEnabled(key, distinctId);

    // posthog-node resolves `undefined` for a timeout or an unknown key.
    if (answer === undefined) {
      logger.error('PostHog returned no answer for a feature flag', { key });
      return 'unreadable';
    }

    return answer ? 'on' : 'off';
  } catch (error) {
    logger.error('Feature flag lookup failed', { key, error });
    return 'unreadable';
  }
};
