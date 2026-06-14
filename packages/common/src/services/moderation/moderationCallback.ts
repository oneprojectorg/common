import { OPURLConfig } from '@op/core';

/**
 * The webhook URL providers POST their async verdict to. Vendors differ in (or
 * lack) request signing, so we authenticate the callback with a shared secret
 * carried in the query string. Returns `null` when the secret isn't configured
 * — without it we can't safely accept callbacks, so the async path stays off
 * (it also acts as the async feature switch for vendors that don't take a
 * per-request callback).
 *
 * How the URL reaches the vendor differs: Hive takes it per submission
 * (`callback_url`); Lasso has no per-request callback — paste this URL into
 * the webhook settings in the Lasso dashboard.
 */
export const getModerationCallbackUrl = (): string | null => {
  const secret = process.env.MODERATION_WEBHOOK_SECRET;
  if (!secret) {
    return null;
  }
  const base = OPURLConfig('API').ENV_URL.replace(/\/$/, '');
  return `${base}/api/v1/moderation/webhooks?secret=${encodeURIComponent(secret)}`;
};

/** The configured shared secret the webhook route validates against. */
export const getModerationWebhookSecret = (): string | undefined =>
  process.env.MODERATION_WEBHOOK_SECRET;
