import { PostHogClient } from '@op/analytics';
import { areFeatureFlagsForcedOn } from '@op/analytics/client-utils';
import { cache } from '@op/cache';

const TTL = 60 * 1000;

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
    fetch: () => PostHogClient().getAllFlags(distinctId),
    options: {
      ttl: TTL,
      // The L1 copy of a Redis hit restarts the clock; Redis alone keeps the bound.
      skipMemCache: true,
    },
  });

  // A variant string counts as on, as it does for `isFeatureEnabled`.
  return Boolean(flags[key]);
};
