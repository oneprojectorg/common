import { Events, event } from '@op/events';

import { insertModerationWebhookDelivery } from './moderationWebhookInboxStore';

export interface RecordModerationWebhookDeliveryInput {
  provider: string;
  deliveryId: string;
  rawBody: string;
  headers: Record<string, string>;
}

export interface RecordModerationWebhookDeliveryResult {
  inboxId: string;
  /** True when this call emitted the dispatch event (a fresh insert, or a
   *  redelivery whose first emit never reached Inngest). False when the row
   *  was already dispatched, so no second event is sent. */
  emitted: boolean;
}

/**
 * Persists a verified vendor delivery to the inbox and emits the
 * `moderation/webhook-received` event the dispatch workflow consumes.
 * Separating these from the HTTP handler means the route returns 200 in
 * inbox insert + event emit time — well below the vendor's 10 s retry budget
 * — and the workflow does the heavy parsing + per-item locking.
 *
 * Redelivery handling: the unique `(provider, deliveryId)` index dedupes the
 * row. We still emit the dispatch event when a redelivery finds the row
 * unprocessed — that covers the durability window where the first attempt
 * persisted the row but crashed (or the route 500'd) before the event reached
 * Inngest. A row that's already been processed (or is mid-dispatch) is left
 * alone; re-emitting then would fan out every verdict a second time.
 */
export const recordModerationWebhookDelivery = async (
  input: RecordModerationWebhookDeliveryInput,
): Promise<RecordModerationWebhookDeliveryResult> => {
  const { delivery, inserted } = await insertModerationWebhookDelivery(input);

  // Emit when we just inserted, or when the prior attempt left the row
  // pending (processedAt still null) — a recovery for the rare insert-then-
  // crash window between the row landing and the event reaching Inngest.
  const shouldEmit = inserted || delivery.processedAt === null;

  if (shouldEmit) {
    await event.send({
      name: Events.moderationWebhookReceived.name,
      data: { inboxId: delivery.id },
    });
  }

  return { inboxId: delivery.id, emitted: shouldEmit };
};
