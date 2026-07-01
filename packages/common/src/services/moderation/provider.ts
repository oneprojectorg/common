import { createCheckstepProvider } from './providers/checkstep';
import type { ModerationProvider } from './types';

/**
 * Resolves the Checkstep moderation provider. Keyed by `MODERATION_API_KEY`;
 * `MODERATION_WEBHOOK_SIGNING_KEY` carries the Checkstep platform signing key
 * used to verify inbound webhooks. When set, every callback must present a
 * valid `x-auth-signature`.
 *
 * Returns `null` when moderation isn't configured (no key) — the feature is
 * simply off. `MODERATION_PROVIDER` is accepted only as `checkstep` (or empty);
 * a non-empty value that isn't `checkstep` throws so a stale config fails
 * loudly rather than silently disabling moderation.
 */
export const getModerationProvider = (): ModerationProvider | null => {
  const vendor = process.env.MODERATION_PROVIDER;
  const apiKey = process.env.MODERATION_API_KEY;
  const webhookSigningKey = process.env.MODERATION_WEBHOOK_SIGNING_KEY;
  if (!apiKey) {
    return null;
  }

  if (vendor && vendor !== 'checkstep') {
    throw new Error(`Unknown MODERATION_PROVIDER: ${vendor}`);
  }

  return createCheckstepProvider({ apiKey, webhookSigningKey });
};
