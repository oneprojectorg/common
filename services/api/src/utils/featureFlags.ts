import { PostHogClient } from '@op/analytics';
import { logger } from '@op/logging';

/**
 * The identity the server evaluates a flag against.
 *
 * PostHog resolves a flag for a person. A sign-in request carries no person
 * yet, and the credential it does carry is a phone number, which must not
 * become a PostHog identity.
 */
const SERVER_DISTINCT_ID = 'op-server';

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
};
