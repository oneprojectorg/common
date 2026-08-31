import { PostHogClient } from '@op/analytics';
import { cache } from '@op/cache';
import { logger } from '@op/logging';

/** The flag that gates signing in with a phone number. */
export const SMS_LOGIN_FLAG = 'sms-login';

/**
 * The identity the server evaluates a flag against.
 *
 * PostHog resolves a flag for a person. This asks on behalf of the deployment
 * rather than anyone in particular, and the credential a sign-in request
 * carries is a phone number, which must not become a PostHog identity.
 */
const SERVER_DISTINCT_ID = 'op-server';

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
 * The answer is all-or-nothing. A percentage rollout targets people, and this
 * asks for one fixed identity, so a partial rollout reads here as whatever
 * that identity happens to get. Treat this as a kill switch, and let the
 * browser handle a staged rollout.
 *
 * Development and end-to-end runs answer `true`, matching `useFeatureFlag` in
 * the app. Both are checked, because a run that matched on only one would show
 * a control the server then refuses.
 *
 * An unreadable flag answers `false`, and the reason reaches the log. Callers
 * that guard access rather than a feature should prefer a credential they hold
 * themselves, so an analytics outage cannot evict anyone.
 *
 * @param key - The flag key, as written in PostHog.
 * @returns Whether the server should serve the feature.
 */
export const isServerFeatureEnabled = async (key: string): Promise<boolean> => {
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.NEXT_PUBLIC_E2E === 'true'
  ) {
    return true;
  }

  const state = await cache({
    type: 'featureFlag',
    params: [key],
    fetch: () => readFlag(key),
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
const readFlag = async (key: string): Promise<FlagState> => {
  try {
    const answer = await PostHogClient().isFeatureEnabled(
      key,
      SERVER_DISTINCT_ID,
    );

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
