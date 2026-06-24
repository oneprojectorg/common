import {
  getModerationProvider,
  getModerationProviderName,
  getModerationWebhookDeliveryById,
  markModerationWebhookDeliveryProcessed,
} from '@op/common';
import { Events, inngest } from '@op/events';

const { moderationWebhookReceived, moderationVerdictReceived } = Events;

/**
 * Reads the inbox row the webhook route persisted, parses the raw payload via
 * the active provider adapter, and fans out one `moderation/verdict-received`
 * event per parsed verdict. The actual flag writes + realtime publish happen
 * in `applyModerationVerdictWorkflow`, where concurrency is keyed by
 * `itemId` so the per-item serialization that used to happen inside the HTTP
 * request now happens between Inngest steps.
 *
 * Idempotency: every step is named and Inngest dedupes by `(function, runId,
 * stepId)`, so a retry after a partial fan-out re-reads the inbox row but
 * doesn't double-send.
 */
export const dispatchModerationWebhookDelivery = inngest.createFunction(
  { id: 'dispatchModerationWebhookDelivery' },
  { event: moderationWebhookReceived.name },
  async ({ event, step }) => {
    const { inboxId } = moderationWebhookReceived.schema.parse(event.data);

    const delivery = await step.run('load-inbox-row', () =>
      getModerationWebhookDeliveryById(inboxId),
    );

    if (!delivery) {
      // The route just persisted this row, so it being missing here is a
      // genuine "someone deleted it" — log + ack rather than throwing into
      // retries that will never succeed.
      console.warn(
        '[moderation-webhook] dispatch: inbox row vanished',
        inboxId,
      );
      return { dispatched: 0, reason: 'inbox-missing' };
    }

    if (delivery.processedAt) {
      // Re-run of a finished delivery. The verdicts were already dispatched on
      // the original run; the function-level `concurrency.key` on the apply
      // workflow would still serialize them, but emitting them again would
      // duplicate the realtime invalidations. Skip.
      return { dispatched: 0, reason: 'already-processed' };
    }

    // Vendor name on the row was the active one when the webhook landed. If
    // ops has since swapped MODERATION_PROVIDER, the current adapter would
    // parse the body with the wrong vendor's schema. Refuse rather than
    // mis-parse — leaves the row pending so a later replay (post-rollback or
    // a vendor-aware reprocessor) can finish it.
    const activeProvider = getModerationProviderName();
    if (activeProvider !== delivery.provider) {
      console.warn('[moderation-webhook] dispatch: provider mismatch', {
        inboxId,
        rowProvider: delivery.provider,
        activeProvider,
      });
      return { dispatched: 0, reason: 'provider-mismatch' };
    }

    const verdicts = await step.run('parse-payload', () => {
      const provider = getModerationProvider();
      if (!provider?.parseWebhook) {
        return [];
      }
      try {
        return provider.parseWebhook({
          rawBody: delivery.rawBody,
          headers: delivery.headers,
        });
      } catch (error) {
        console.error(
          '[moderation-webhook] dispatch: parse failed',
          inboxId,
          error,
        );
        return null;
      }
    });

    if (verdicts === null) {
      await step.run('mark-parse-failed', () =>
        markModerationWebhookDeliveryProcessed(inboxId, 'parse_failed'),
      );
      return { dispatched: 0, reason: 'parse-failed' };
    }

    if (verdicts.length > 0) {
      await step.sendEvent(
        'fan-out-verdicts',
        verdicts.map((verdict) => ({
          name: moderationVerdictReceived.name,
          data: {
            inboxId,
            // `itemType:itemId` so the apply workflow's `concurrency.key`
            // expression is a single field path rather than a CEL operator
            // chain — same per-item serialization, simpler key.
            concurrencyKey: `${verdict.itemType}:${verdict.itemId}`,
            ...verdict,
          },
        })),
      );
    }

    await step.run('mark-success', () =>
      markModerationWebhookDeliveryProcessed(inboxId, 'success'),
    );

    return { dispatched: verdicts.length };
  },
);
