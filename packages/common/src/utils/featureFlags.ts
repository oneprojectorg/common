import { PostHogClient } from '@op/analytics';
import { areFeatureFlagsForcedOn } from '@op/analytics/client-utils';
import { cache } from '@op/cache';
import { logger } from '@op/logging';

const TTL = 60 * 1000;

type Flags = Record<string, string | boolean>;

/**
 * Agrees with `useFeatureFlag` only for person or cohort targeting: the browser
 * identifies a user only after tracking consent.
 *
 * One PostHog request per user per {@link TTL} answers every flag. posthog-node
 * reports an outage as an empty map, so every flag reads as off until the
 * cached answer expires.
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

  const flags = await cache({
    type: 'featureFlag',
    params: [distinctId],
    fetch: () => readFlags(distinctId),
    options: {
      ttl: TTL,
      // The L1 copy of a Redis hit restarts the clock; Redis alone keeps the bound.
      skipMemCache: true,
    },
  });

  // A variant string counts as on, as it does for `isFeatureEnabled`.
  return Boolean(flags[key]);
};

const readFlags = async (distinctId: string): Promise<Flags> => {
  try {
    return await PostHogClient().getAllFlags(distinctId);
  } catch (error) {
    // posthog-node swallows request errors; this is a missing API key or a bug.
    logger.error('Feature flag lookup failed', { error });
    return {};
  }
};
