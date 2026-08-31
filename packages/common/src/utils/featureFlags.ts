import { PostHogClient } from '@op/analytics';
import { cache } from '@op/cache';
import { logger } from '@op/logging';

/** The flag that gates signing in with a phone number. */
export const SMS_LOGIN_FLAG = 'sms-login';

/**
 * The identity the server evaluates a flag against.
 *
 * PostHog resolves a flag for a person. A sign-in request carries no person
 * yet, and the credential it does carry is a phone number, which must not
 * become a PostHog identity.
 */
const SERVER_DISTINCT_ID = 'op-server';

/** How long an answer is reused. A kill switch tolerates this much delay. */
const TTL = 60 * 1000;

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
 * Answers are cached, because this is now read on the path that authorizes a
 * request rather than only when someone signs in. Turning a flag off takes up
 * to a minute to take effect everywhere.
 *
 * Development answers `true`, matching `useFeatureFlag` in the app. Without
 * that, a local run would show a control the server then refuses.
 *
 * Fails closed. A PostHog outage disables the gated feature rather than
 * opening it, which is the safe direction for a feature that is off by
 * default.
 *
 * @param key - The flag key, as written in PostHog.
 * @returns Whether the server should serve the feature.
 */
export const isServerFeatureEnabled = async (key: string): Promise<boolean> => {
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  return cache({
    type: 'featureFlag',
    params: [key],
    fetch: async () => {
      try {
        return Boolean(
          await PostHogClient().isFeatureEnabled(key, SERVER_DISTINCT_ID),
        );
      } catch (error) {
        logger.warn('Feature flag lookup failed; treating the flag as off', {
          key,
          error,
        });
        return false;
      }
    },
    options: { ttl: TTL },
  });
};
