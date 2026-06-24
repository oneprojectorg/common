import type { TransactionType } from '@op/db/client';
import { eventOutbox } from '@op/db/schema';
import type { z } from 'zod';

import { Events } from './types';

/**
 * The union of all known event payloads — mirrors the shape `inngest.send`
 * accepts but constrained to the events declared in `Events`. Used to keep
 * the outbox write strongly typed against the same schema map.
 */
export type OutboxEvent = {
  [K in keyof typeof Events]: {
    name: (typeof Events)[K]['name'];
    data: z.infer<(typeof Events)[K]['schema']>;
  };
}[keyof typeof Events];

/**
 * Persist an event to the outbox inside the caller's transaction.
 *
 * Use this when the event MUST eventually reach Inngest even if the live
 * publish call fails (Inngest brownout, deploy, network blip). A drainer
 * cron picks up undelivered rows and publishes them. The cron is the
 * delivery guarantee — the live `inngest.send` call at the route layer is
 * just a latency optimization.
 *
 * Pass the same `tx` you used to write the source-of-truth row(s); if the
 * outer transaction rolls back, the outbox row rolls back with it, so we
 * never publish an event for a write that didn't happen.
 */
export const outboxSend = async (
  tx: TransactionType,
  event: OutboxEvent,
): Promise<string> => {
  const [row] = await tx
    .insert(eventOutbox)
    .values({
      eventName: event.name,
      eventData: event.data,
    })
    .returning({ id: eventOutbox.id });

  if (!row) {
    throw new Error('Failed to insert event_outbox row');
  }

  return row.id;
};
