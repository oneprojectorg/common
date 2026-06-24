import {
  getModerationItemChannels,
  getModerationProvider,
  getModerationWebhookSecret,
  handleModerationWebhook,
  recordModerationVerdict,
} from '@op/common';
import { logger } from '@op/logging';
import { realtime } from '@op/realtime/server';
import { randomUUID } from 'node:crypto';

export interface ModerationWebhookRequest {
  rawBody: string;
  headers: Record<string, string>;
  providedSecret?: string;
}

/**
 * Wires the moderation webhook handler with the configured provider, shared
 * secret, and the DB-backed verdict recorder. The HTTP route (apps/api) reads
 * the raw request and delegates here, keeping vendor/DB logic in the API layer.
 *
 * When a verdict actually changes the item's state (flag created, confirmed,
 * or dismissed — anything but a no-op), an invalidation is published to the
 * item's realtime channels, exactly like a tRPC mutation would: every
 * subscribed client refetches and the item hides (or un-hides) immediately
 * instead of waiting for a manual reload.
 */
export const handleModerationWebhookRequest = (
  request: ModerationWebhookRequest,
) =>
  handleModerationWebhook(request, {
    expectedSecret: getModerationWebhookSecret(),
    provider: getModerationProvider(),
    applyVerdict: async (verdict) => {
      const result = await recordModerationVerdict(verdict);

      // Realtime invalidation is strictly best-effort and runs *after* the
      // verdict has already committed. The whole block is wrapped (not just
      // `publishMany`, which guards itself): the channel lookup is two DB
      // queries for posts, and if it threw, the webhook would 500, the
      // provider would retry, and the now-idempotent verdict would no-op —
      // permanently losing the invalidation while the flag is correct in the
      // DB. Clients would keep their stale view until a manual reload.
      // Detach on a `flagged`-already row lands as `action: 'noop'`, but the
      // proposal did change (moderation_detached_at just flipped). Invalidate
      // on `detached` too so admin lists refetch and drop the item.
      if (result.action !== 'noop' || result.detached) {
        try {
          const channels = await getModerationItemChannels(
            verdict.itemType,
            verdict.itemId,
          );
          await realtime.publishMany(channels, { mutationId: randomUUID() });
        } catch (error) {
          logger.error('[moderation-webhook] realtime invalidation failed', {
            error,
          });
        }
      }

      return result;
    },
  });
