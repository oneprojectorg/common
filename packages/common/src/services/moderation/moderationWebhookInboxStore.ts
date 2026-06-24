import { and, db, eq } from '@op/db/client';
import {
  type ModerationWebhookInbox,
  moderationWebhookInbox,
} from '@op/db/schema';

const now = () => new Date().toISOString();

export interface InsertModerationWebhookDeliveryInput {
  provider: string;
  deliveryId: string;
  rawBody: string;
  headers: Record<string, string>;
}

export interface InsertModerationWebhookDeliveryResult {
  /** The inbox row, whether the caller inserted it or lost the race. */
  delivery: ModerationWebhookInbox;
  /** True only when this call inserted the row. The race loser uses this to
   *  skip emitting the dispatch event the winner already emitted, so a vendor
   *  redelivery becomes a 200 ack with no double-processing. */
  inserted: boolean;
}

/**
 * Persists a vendor delivery to the inbox, idempotent on
 * `(provider, deliveryId)`. The dispatch workflow event is emitted by the
 * caller (only on `inserted: true`) so a redelivery doesn't trigger a second
 * parse + verdict pass.
 */
export const insertModerationWebhookDelivery = async (
  input: InsertModerationWebhookDeliveryInput,
): Promise<InsertModerationWebhookDeliveryResult> => {
  const [inserted] = await db
    .insert(moderationWebhookInbox)
    .values({
      provider: input.provider,
      deliveryId: input.deliveryId,
      rawBody: input.rawBody,
      headers: input.headers,
    })
    .onConflictDoNothing()
    .returning();
  if (inserted) {
    return { delivery: inserted, inserted: true };
  }
  const existing = await findModerationWebhookDelivery(
    input.provider,
    input.deliveryId,
  );
  if (!existing) {
    // The conflict path lost the race but the row also isn't there on re-read
    // — possible under aggressive retention pruning, but unexpected. Re-throw
    // so the route surfaces a 500 (vendor will retry, the redelivery hits the
    // success path on the next attempt).
    throw new Error('Moderation webhook inbox row vanished after conflict');
  }
  return { delivery: existing, inserted: false };
};

export const findModerationWebhookDelivery = async (
  provider: string,
  deliveryId: string,
): Promise<ModerationWebhookInbox | undefined> => {
  const [row] = await db
    .select()
    .from(moderationWebhookInbox)
    .where(
      and(
        eq(moderationWebhookInbox.provider, provider),
        eq(moderationWebhookInbox.deliveryId, deliveryId),
      ),
    )
    .limit(1);
  return row;
};

export const getModerationWebhookDeliveryById = async (
  id: string,
): Promise<ModerationWebhookInbox | undefined> => {
  const [row] = await db
    .select()
    .from(moderationWebhookInbox)
    .where(eq(moderationWebhookInbox.id, id))
    .limit(1);
  return row;
};

export type ModerationWebhookDeliveryStatus = 'success' | 'parse_failed';

/** Marks an inbox row processed. Called once per delivery from the dispatch
 *  workflow after the payload has been parsed and verdicts have been fanned
 *  out (or after a parse failure was logged). */
export const markModerationWebhookDeliveryProcessed = async (
  id: string,
  status: ModerationWebhookDeliveryStatus,
): Promise<void> => {
  await db
    .update(moderationWebhookInbox)
    .set({ processedAt: now(), processedStatus: status })
    .where(eq(moderationWebhookInbox.id, id));
};
