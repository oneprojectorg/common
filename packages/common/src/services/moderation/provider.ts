import { createCheckstepProvider } from './providers/checkstep';
import { createHiveProvider } from './providers/hive';
import { createLassoProvider } from './providers/lasso';
import type { ModerationProvider } from './types';

/**
 * Builds the moderation provider for the vendor named by `MODERATION_PROVIDER`
 * (`hive` | `lasso` | `checkstep`) from that vendor's API key. The same vendor
 * serves both the sync gate and async review.
 *
 * Returns `null` when moderation isn't configured (no vendor selected, or the
 * selected vendor has no key) — the feature is simply off. Throws on an
 * unrecognized vendor value so a typo fails loudly rather than silently
 * disabling moderation.
 */
export const buildModerationProvider = (): ModerationProvider | null => {
  const vendor = process.env.MODERATION_PROVIDER;
  if (!vendor) {
    return null;
  }

  switch (vendor) {
    case 'hive': {
      const apiKey = process.env.HIVE_API_KEY;
      return apiKey ? createHiveProvider({ apiKey }) : null;
    }
    case 'lasso': {
      const apiToken = process.env.LASSO_API_TOKEN;
      return apiToken ? createLassoProvider({ apiToken }) : null;
    }
    case 'checkstep': {
      const apiKey = process.env.CHECKSTEP_API_KEY;
      return apiKey ? createCheckstepProvider({ apiKey }) : null;
    }
    default:
      throw new Error(`Unknown MODERATION_PROVIDER: ${vendor}`);
  }
};

// `undefined` = not yet built; `null` = built but feature off.
let cached: ModerationProvider | null | undefined;

/**
 * Lazily builds and memoizes the provider singleton from the environment.
 */
export const getModerationProvider = (): ModerationProvider | null => {
  if (cached === undefined) {
    cached = buildModerationProvider();
  }
  return cached;
};
