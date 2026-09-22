import { PostHogClient } from '@op/analytics';
import { areFeatureFlagsForcedOn } from '@op/analytics/client-utils';
import { cache } from '@op/cache';
import { logger } from '@op/logging';

/** The flag that gates the new process admin, the wizard included. */
export const NEW_PROCESS_ADMIN_FLAG = 'new_process_admin_enabled';

/**
 * Restored from the reader deleted in fbbc240ae, which went because its last
 * caller went. Two things differ.
 *
 * It takes the identity rather than asking for a fixed `op-server` one. That
 * choice made the old reader a kill switch and said so: one identity gets one
 * answer, so a percentage rollout reads as whatever that identity draws. Its
 * caller was a sign-in endpoint whose only credential was a phone number,
 * which must not become a PostHog identity. This caller has an authenticated
 * user, and `UserProvider` already identifies that same user to PostHog on
 * `authUserId`, so passing it through resolves a staged rollout the same way
 * the browser does and a gated page agrees with the menu item that links to it.
 *
 * And the forced-on rule is imported rather than restated — that consolidation
 * is what fbbc240ae was for.
 */
/** How long an answer is reused. A kill switch tolerates this much delay. */
const TTL = 60 * 1000;

/**
 * What PostHog told us, including the case where it told us nothing.
 *
 * A string rather than a boolean for two reasons. "Off" and "unreadable" need
 * different handling, and `cache()` writes only truthy values, so a `false`
 * would never be stored and every request would call PostHog again.
 */
type FlagState = 'on' | 'off' | 'unreadable';

/**
 * Whether a feature is on for the server.
 *
 * Use this to gate a procedure whose UI is already gated. Hiding a control
 * stops a person from finding a feature; it does not stop anyone from calling
 * the endpoint behind it, which matters most for the endpoints that sign
 * someone in.
 *
 * Cached per key and identity for {@link TTL}. A kill switch tolerates that
 * much delay, and it keeps a page render off PostHog's critical path.
 *
 * Development and end-to-end runs answer `true` through
 * {@link areFeatureFlagsForcedOn}, the same predicate `useFeatureFlag` uses, so
 * a run cannot show a control the server then refuses.
 *
 * An unreadable flag answers `false`, and the reason reaches the log. Callers
 * that guard access rather than a feature should prefer a credential they hold
 * themselves, so an analytics outage cannot evict anyone.
 *
 * @param key - The flag key, as written in PostHog.
 * @param distinctId - The identity to resolve against, matching the browser's.
 * @returns Whether the server should serve the feature.
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
      // An outage must not overwrite a good answer. Leaving the entry alone
      // keeps the last one serving until it expires on its own.
      skipCacheWrite: (result) => result === 'unreadable',
    },
  });

  return state === 'on';
};

/**
 * Asks PostHog, and reports silence as its own answer.
 *
 * `isFeatureEnabled` resolves `undefined` on a request error, a timeout, or an
 * unknown flag key. It does not throw, so a `catch` alone would let every one
 * of those read as "off" with nothing written to the log.
 */
const readFlag = async (
  key: string,
  distinctId: string,
): Promise<FlagState> => {
  try {
    const answer = await PostHogClient().isFeatureEnabled(key, distinctId);

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
