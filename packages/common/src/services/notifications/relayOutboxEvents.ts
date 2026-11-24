import { db } from '@op/db/client';
import { eventOutbox } from '@op/db/schema';
import { logger } from '@op/logging';
import { asc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { type OutboxEvent, buildOutboxEvent } from './buildOutboxEvent';

export interface RelayOutboxEventsInput {
  send: (event: OutboxEvent) => Promise<void>;
  limit?: number;
  ids?: string[];
}

export const relayOutboxEvents = async ({
  send,
  limit = 100,
  ids,
}: RelayOutboxEventsInput) => {
  const unsent = isNull(eventOutbox.sentAt);
  const rows = await db
    .select()
    .from(eventOutbox)
    .where(ids ? sql`${unsent} AND ${inArray(eventOutbox.id, ids)}` : unsent)
    .orderBy(asc(eventOutbox.createdAt), asc(eventOutbox.id))
    .limit(limit);

  let sent = 0;
  let failed = 0;

  // Sequential on purpose: the relay runs one sweep at a time (ADR 0023).
  for (const row of rows) {
    try {
      await send(buildOutboxEvent(row));
      await db
        .update(eventOutbox)
        .set({
          sentAt: sql`(now() AT TIME ZONE 'utc'::text)`,
          attempts: row.attempts + 1,
        })
        .where(eq(eventOutbox.id, row.id));
      sent += 1;
    } catch (error) {
      logger.error('Outbox relay failed to send event', {
        error,
        outboxId: row.id,
        eventName: row.eventName,
      });
      await db
        .update(eventOutbox)
        .set({ attempts: row.attempts + 1 })
        .where(eq(eventOutbox.id, row.id));
      failed += 1;
    }
  }

  return { sent, failed };
};
