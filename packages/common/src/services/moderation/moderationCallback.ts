import { OPURLConfig } from '@op/core';

/**
 * The webhook URL Checkstep POSTs its async verdict to. We authenticate the
 * callback with a shared secret carried in the query string; Checkstep also
 * signs the payload, but the shared secret keeps the URL usable even when the
 * signing key isn't configured. Returns `null` when the secret isn't set —
 * without it we can't safely accept callbacks, so the async path stays off.
 *
 * The URL is passed to Checkstep per submission via `callback_url`.
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
