import { createCheckstepProvider } from './providers/checkstep';
import { createHiveProvider } from './providers/hive';
import { createLassoProvider } from './providers/lasso';
import type { ModerationProvider } from './types';

/**
 * Resolves the moderation provider for the vendor named by `MODERATION_PROVIDER`
 * (`hive` | `lasso` | `checkstep`), keyed by the single `MODERATION_API_KEY`.
 * One vendor is active at a time, so one key suffices — swap the key value when
 * switching vendors. The same vendor serves both the sync gate and async review.
 *
 * `MODERATION_WEBHOOK_SIGNING_KEY` carries the vendor's webhook signing secret
 * (Checkstep: the platform signing key; Lasso: the dashboard webhook secret).
 * When set, the vendor adapter verifies the signature on every inbound webhook.
 * Hive documents no signing for async callbacks, so its callbacks are gated by
 * the shared-secret callback URL alone.
 *
 * Returns `null` when moderation isn't configured (no vendor selected, or no
 * key) — the feature is simply off. Throws on an unrecognized vendor value so a
 * typo fails loudly rather than silently disabling moderation.
 */
export const getModerationProvider = (): ModerationProvider | null => {
  const vendor = process.env.MODERATION_PROVIDER;
  const apiKey = process.env.MODERATION_API_KEY;
  const webhookSigningKey = process.env.MODERATION_WEBHOOK_SIGNING_KEY;
  if (!vendor || !apiKey) {
    return null;
  }

  switch (vendor) {
    case 'hive':
      return createHiveProvider({ apiKey });
    case 'lasso':
      return createLassoProvider({ apiToken: apiKey, webhookSigningKey });
    case 'checkstep':
      return createCheckstepProvider({ apiKey, webhookSigningKey });
    default:
      throw new Error(`Unknown MODERATION_PROVIDER: ${vendor}`);
  }
};
